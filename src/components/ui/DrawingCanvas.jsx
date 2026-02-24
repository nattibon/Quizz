import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './Button';
import { Eraser, Undo, RefreshCcw, Save, PenTool, Highlighter } from 'lucide-react';

export default function DrawingCanvas({ initialDataUrl, onSave, overlayMode = false, isDrawingMode = true }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [activeTool, setActiveTool] = useState('pen'); // 'pen', 'highlighter', 'eraser'
    const [currentColor, setCurrentColor] = useState('#0f172a'); // default slate-900

    // Hold-to-snap to straight line states
    const startPointRef = useRef(null);
    const lastPointRef = useRef(null);
    const holdTimerRef = useRef(null);
    const isDrawingRef = useRef(false);
    const isLineSnappedRef = useRef(false);
    const isBlockDrawingRef = useRef(false);
    const [isBlockDrawing, setIsBlockDrawing] = useState(false);
    const [lineSnapEnabled, setLineSnapEnabled] = useState(true);

    // Custom internal caching due to signature_pad v2 dropping line widths from stroke exports
    const cachedStrokesRef = useRef([]);
    const bgImageRef = useRef(null);

    // Global listener to release the UI block when user lifts pen after snapping
    useEffect(() => {
        const handleGlobalUp = () => {
            if (isBlockDrawingRef.current) {
                setIsBlockDrawing(false);
                isBlockDrawingRef.current = false;
                // Small delay to ensure touch events are completely flushed before re-enabling
                setTimeout(() => {
                    if (canvasRef.current && canvasRef.current._signaturePad) {
                        canvasRef.current._signaturePad.on();
                    }
                }, 50);
            }
        };
        window.addEventListener('pointerup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);
        window.addEventListener('touchcancel', handleGlobalUp);

        return () => {
            window.removeEventListener('pointerup', handleGlobalUp);
            window.removeEventListener('touchend', handleGlobalUp);
            window.removeEventListener('touchcancel', handleGlobalUp);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        };
    }, []);

    // --- Monkey-patch SignaturePad to detect holds using its exact native data ---
    const holdStateRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !canvasRef.current._signaturePad) return;
        const pad = canvasRef.current._signaturePad;

        // Save original methods
        const originalBegin = pad._strokeBegin;
        const originalUpdate = pad._strokeUpdate;
        const originalEnd = pad._strokeEnd;

        // Patch Begin
        pad._strokeBegin = function (event) {
            if (isBlockDrawingRef.current) return;

            isDrawingRef.current = true;
            isLineSnappedRef.current = false;
            holdStateRef.current = null;
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

            // Execute original
            originalBegin.call(this, event);

            startHoldTimer();
        };

        // Patch Update
        pad._strokeUpdate = function (event) {
            if (isBlockDrawingRef.current || isLineSnappedRef.current) return;

            // Execute original
            originalUpdate.call(this, event);

            const rawData = this._data;
            if (!rawData || rawData.length === 0) return;
            const currentStroke = rawData[rawData.length - 1]; // In v2 this is an array of points!
            if (!currentStroke || currentStroke.length === 0) return;

            const latestPoint = currentStroke[currentStroke.length - 1];

            // Initialize hold center if first time moving
            if (!holdStateRef.current) {
                holdStateRef.current = { x: latestPoint.x, y: latestPoint.y };
                startHoldTimer();
                return;
            }

            const dx = latestPoint.x - holdStateRef.current.x;
            const dy = latestPoint.y - holdStateRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 15 pixels resting radius threshold for hand tremors on iPad
            if (dist > 15) {
                // Pen moved outside resting radius, reset the hold center and start a fresh timer
                holdStateRef.current = { x: latestPoint.x, y: latestPoint.y };
                startHoldTimer();
            }
        };

        // Patch End
        pad._strokeEnd = function (event) {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            isDrawingRef.current = false;

            if (isBlockDrawingRef.current || isLineSnappedRef.current) return;

            // Execute original
            originalEnd.call(this, event);
        };

        return () => {
            // Clean up monkey patches on unmount
            if (pad) {
                pad._strokeBegin = originalBegin;
                pad._strokeUpdate = originalUpdate;
                pad._strokeEnd = originalEnd;
            }
        };
    }, []);

    const colors = [
        { name: 'ดำ (Black)', value: '#0f172a', bgClass: 'bg-slate-900' },
        { name: 'น้ำเงิน (Blue)', value: '#2563eb', bgClass: 'bg-blue-600' },
        { name: 'แดง (Red)', value: '#dc2626', bgClass: 'bg-red-600' },
        { name: 'เขียว (Green)', value: '#16a34a', bgClass: 'bg-green-600' },
        { name: 'ม่วง (Purple)', value: '#9333ea', bgClass: 'bg-purple-600' },
        { name: 'ชมพู (Pink)', value: '#db2777', bgClass: 'bg-pink-600' },
        { name: 'ส้ม (Orange)', value: '#ea580c', bgClass: 'bg-orange-600' },
        { name: 'ฟ้า (Teal)', value: '#0d9488', bgClass: 'bg-teal-600' },
    ];

    // Determine current canvas properties based on tool and color
    let penColor = currentColor;
    let minWidth = 1.5;
    let maxWidth = 4;
    let velocityFilterWeight = 0.7;

    if (activeTool === 'highlighter') {
        const solidMap = {
            '#0f172a': '#fde047', // Yellow for default (black)
            '#2563eb': '#93c5fd', // Light Blue
            '#dc2626': '#fca5a5', // Light Red
            '#16a34a': '#86efac', // Light Green
            '#9333ea': '#d8b4fe', // Light Purple
            '#db2777': '#fbcfe8', // Light Pink
            '#ea580c': '#fdba74', // Light Orange
            '#0d9488': '#5eead4'  // Light Teal
        };
        penColor = solidMap[currentColor] || '#fde047';
        minWidth = 14;
        maxWidth = 20;
        velocityFilterWeight = 0.5; // Moderate smoothing
    } else if (activeTool === 'eraser') {
        penColor = '#ffffff'; // Draw over with white background
        minWidth = 16;
        minWidth = 16;
        maxWidth = 24;
    }

    // Master renderer to reconstruct canvas cleanly keeping diverse tools styles
    const redrawCustomStrokes = () => {
        if (!canvasRef.current || !canvasRef.current._signaturePad) return;
        const pad = canvasRef.current._signaturePad;

        pad.clear();

        if (bgImageRef.current) {
            const ctx = pad._ctx;
            const canvas = pad._canvas;
            // Get ratio from window
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const width = canvas.width / ratio;
            const height = canvas.height / ratio;
            ctx.drawImage(bgImageRef.current, 0, 0, width, height);
            pad._isEmpty = false;
        }

        const strokes = cachedStrokesRef.current;
        if (strokes.length === 0) return;

        const oldColor = pad.penColor;
        const oldMin = pad.minWidth;
        const oldMax = pad.maxWidth;
        const oldVelocity = pad.velocityFilterWeight;

        const originalData = [];

        strokes.forEach(stroke => {
            pad.penColor = stroke.penColor;
            pad.minWidth = stroke.minWidth;
            pad.maxWidth = stroke.maxWidth;
            pad.velocityFilterWeight = stroke.velocityFilterWeight;

            pad._fromData(
                [stroke.points],
                (curve, widths) => pad._drawCurve(curve, widths.start, widths.end),
                (rawPoint) => pad._drawDot(rawPoint)
            );
            originalData.push(stroke.points);
        });

        pad._data = originalData;

        // Restore active tools
        pad.penColor = oldColor;
        pad.minWidth = oldMin;
        pad.maxWidth = oldMax;
        pad.velocityFilterWeight = oldVelocity;
    };

    // Initial Resize and Window Resize listener
    useEffect(() => {
        const resizeCanvas = () => {
            if (canvasRef.current && containerRef.current) {
                const canvas = canvasRef.current.getCanvas();
                const ratio = Math.max(window.devicePixelRatio || 1, 1);

                // Save current drawing
                const data = canvasRef.current.toData();

                const rect = containerRef.current.getBoundingClientRect();

                // Update internal resolution to match display size exactly, accounting for pixel density
                canvas.width = rect.width * ratio;
                canvas.height = rect.height * ratio;
                canvas.getContext("2d").scale(ratio, ratio);

                // For react-signature-canvas, we also need to inform the internal pad of the new dimensions
                if (canvasRef.current._signaturePad) {
                    canvasRef.current._signaturePad.clear();
                }

                // Restore drawing cleanly from our diverse styles cache
                redrawCustomStrokes();
            }
        };

        const handleScroll = () => {
            // Force the signature pad to update its internal offset mapping
            if (canvasRef.current && canvasRef.current._signaturePad) {
                // accessing private method to force coordinate recalculation on scroll
                // This is a known workaround for react-signature-canvas offset bugs
            }
        };

        // Resize on mount and when window resizes
        const timeoutId = setTimeout(resizeCanvas, 150);
        window.addEventListener("resize", resizeCanvas);
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(timeoutId);
        }
    }, []);

    // Load initial data if provided
    useEffect(() => {
        if (initialDataUrl && canvasRef.current) {
            const img = new Image();
            img.onload = () => {
                bgImageRef.current = img;
                if (canvasRef.current) {
                    canvasRef.current.fromDataURL(initialDataUrl);
                    setIsEmpty(false);
                }
            };
            img.src = initialDataUrl;
        }
    }, [initialDataUrl]);

    const handleClear = () => {
        cachedStrokesRef.current = [];
        bgImageRef.current = null;
        if (canvasRef.current) canvasRef.current.clear();
        setIsEmpty(true);
        onSave(''); // Clear saved data
        isLineSnappedRef.current = false;
    };

    const handleUndo = () => {
        if (!canvasRef.current) return;

        if (cachedStrokesRef.current.length > 0) {
            cachedStrokesRef.current.pop(); // remove last stroke
            redrawCustomStrokes();

            if (cachedStrokesRef.current.length === 0 && !bgImageRef.current) {
                setIsEmpty(true);
                onSave('');
            } else {
                onSave(canvasRef.current.toDataURL('image/png'));
            }
        } else if (bgImageRef.current) {
            // Let them wipe the background if strokes are empty
            handleClear();
        }
    };

    const handleEndStrokeNative = () => {
        if (!isLineSnappedRef.current && canvasRef.current && canvasRef.current._signaturePad) {
            const pad = canvasRef.current._signaturePad;
            const rawData = pad._data;
            if (rawData && rawData.length > 0) {
                const currentPoints = rawData[rawData.length - 1]; // Array of points
                cachedStrokesRef.current.push({
                    points: [...currentPoints],
                    penColor,
                    minWidth,
                    maxWidth,
                    velocityFilterWeight
                });
            }
        }

        setIsEmpty(canvasRef.current.isEmpty());
        if (!canvasRef.current.isEmpty()) {
            onSave(canvasRef.current.toDataURL('image/png'));
        } else {
            onSave('');
        }
    };

    const startHoldTimer = () => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        // Transform to straight line if held for 500ms securely
        holdTimerRef.current = setTimeout(snapToStraightLine, 500);
    };

    const snapToStraightLine = () => {
        if (!isDrawingRef.current || isLineSnappedRef.current) return;
        if (!canvasRef.current || !canvasRef.current._signaturePad) return;

        const pad = canvasRef.current._signaturePad;
        const rawData = pad._data;
        if (!rawData || rawData.length === 0) return;

        const currentStroke = rawData[rawData.length - 1]; // Array of points
        if (!currentStroke || currentStroke.length < 3) return;

        const start = currentStroke[0];
        const end = currentStroke[currentStroke.length - 1];

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 20) {
            isLineSnappedRef.current = true;

            const straightPoints = [];
            const steps = Math.max(10, Math.floor(distance / 5));
            const timeStep = Math.max(10, (end.time - start.time) / steps);

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                straightPoints.push({
                    x: start.x + dx * t,
                    y: start.y + dy * t,
                    time: start.time + (timeStep * i),
                    color: currentStroke[0]?.color || penColor,
                });
            }

            // Stop internal drawing smoothly without firing the user-facing onEnd
            const origOnEnd = pad.onEnd;
            pad.onEnd = null;
            pad._strokeEnd(new Event('mouseup'));
            pad.onEnd = origOnEnd;

            const newStroke = {
                points: straightPoints,
                penColor: currentStroke[0]?.color || penColor,
                minWidth,
                maxWidth,
                velocityFilterWeight
            };

            cachedStrokesRef.current.push(newStroke);

            pad.off();
            isBlockDrawingRef.current = true;
            setIsBlockDrawing(true);

            redrawCustomStrokes();

            // Explicitly call the save since we bypassed normal end hooks
            handleEndStrokeNative();
        }
    };


    return (
        <div className={`w-full ${overlayMode ? 'absolute inset-0 pointer-events-none' : 'flex flex-col gap-3'}`}>
            {/* Toolbar */}
            {(!overlayMode || isDrawingMode) && (
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${overlayMode ? 'bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 mt-4 mx-4 relative z-50 pointer-events-auto ring-1 ring-slate-900/5' : 'px-1 border-b border-slate-100 pb-3'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Tool Picker */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActiveTool('pen')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'pen' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ปากกา (Pen)"
                            >
                                <PenTool size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTool('highlighter')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'highlighter' ? 'bg-white shadow-sm text-amber-500 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ไฮไลต์ (Highlighter)"
                            >
                                <Highlighter size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTool('eraser')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'eraser' ? 'bg-white shadow-sm text-pink-500 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ยางลบ (Eraser)"
                            >
                                <Eraser size={18} />
                            </button>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                        {/* Color Picker */}
                        <div className="flex gap-2 items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            {colors.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => { setCurrentColor(c.value); if (activeTool === 'eraser') setActiveTool('pen'); }}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${currentColor === c.value && activeTool !== 'eraser' ? 'scale-125 border-primary-300' : 'border-transparent hover:scale-110'} ${c.bgClass} shadow-sm`}
                                    title={c.name}
                                    aria-label={`เลือกสี ${c.name}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUndo}
                            disabled={isEmpty}
                            className="text-slate-600 hover:text-slate-900"
                        >
                            <Undo className="w-4 h-4 mr-1.5" /> ย้อนกลับ
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={isEmpty}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <RefreshCcw className="w-4 h-4 mr-1.5" /> ล้าง
                        </Button>
                    </div>
                </div>
            )}

            <div
                ref={containerRef}
                className={`${overlayMode ? `absolute inset-0 mix-blend-multiply z-40 ${isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'}` : 'border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner relative touch-none'} w-full ${isBlockDrawing ? 'pointer-events-none' : ''}`}
                style={overlayMode ? {} : { height: '500px' }}
            >
                <SignatureCanvas
                    ref={canvasRef}
                    penColor={penColor}
                    velocityFilterWeight={velocityFilterWeight}
                    minWidth={minWidth}
                    maxWidth={maxWidth}
                    clearOnResize={false}
                    canvasProps={{
                        className: `w-full h-full cursor-crosshair ${isDrawingMode ? 'touch-none select-none' : ''}`,
                        style: { display: 'block' }
                    }}
                    onEnd={handleEndStrokeNative}
                />
            </div>

            {!overlayMode && (
                <p className="text-xs text-slate-400 text-right pr-2 mt-1">
                    รองรับการใช้นิ้วมือ และ ปากกา Stylus สำหรับแท็บเล็ต ระบบจะเริ่มบันทึกอัตโนมัติเมื่อวาดเสร็จ
                </p>
            )}
        </div>
    );
}
