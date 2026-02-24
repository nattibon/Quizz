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
    const holdStateRef = useRef({ lastX: 0, lastY: 0 });

    useEffect(() => {
        if (!canvasRef.current || !canvasRef.current._signaturePad) return;
        const pad = canvasRef.current._signaturePad;

        // Save original methods
        const originalBegin = pad._strokeBegin;
        const originalUpdate = pad._strokeUpdate;
        const originalEnd = pad._strokeEnd;

        // Patch Begin
        pad._strokeBegin = function (event) {
            isDrawingRef.current = true;
            isLineSnappedRef.current = false;
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdStateRef.current = { lastX: 0, lastY: 0 };

            // Execute original
            originalBegin.call(this, event);

            // Start the hold timer immediately for the first point
            startHoldTimer();
        };

        // Patch Update
        pad._strokeUpdate = function (event) {
            // Execute original
            originalUpdate.call(this, event);

            if (isLineSnappedRef.current) return;

            // Extract the active stroke array that was just updated
            const rawData = this._data;
            if (!rawData || rawData.length === 0) return;
            const currentStroke = rawData[rawData.length - 1];
            if (!currentStroke || !currentStroke.points || currentStroke.points.length === 0) return;

            const latestPoint = currentStroke.points[currentStroke.points.length - 1];

            // If we just started, initialize the hold center
            if (holdStateRef.current.lastX === 0 && holdStateRef.current.lastY === 0) {
                holdStateRef.current = { lastX: latestPoint.x, lastY: latestPoint.y };
            }

            // Check distance from hold center
            const dx = latestPoint.x - holdStateRef.current.lastX;
            const dy = latestPoint.y - holdStateRef.current.lastY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 20 pixels threshold to allow for hand tremors on high DPI iPad screens
            // Previous 40px was too loose and caused strokes to falsely snap early
            if (dist > 20) {
                // Pen moved significantly, reset the hold center and start a fresh timer
                holdStateRef.current = { lastX: latestPoint.x, lastY: latestPoint.y };
                if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                startHoldTimer();
            }
        };

        // Patch End
        pad._strokeEnd = function (event) {
            // Cancel timer
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            isDrawingRef.current = false;

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
        maxWidth = 24;
    }

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

                // Restore drawing smoothly
                if (data && data.length > 0) {
                    canvasRef.current.fromData(data);
                }
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
            // Need a slight delay to ensure canvas is properly sized before loading data
            setTimeout(() => {
                canvasRef.current.fromDataURL(initialDataUrl);
                setIsEmpty(false);
            }, 150);
        }
    }, [initialDataUrl]);

    const handleClear = () => {
        if (canvasRef.current) canvasRef.current.clear();
        setIsEmpty(true);
        onSave(''); // Clear saved data
        isLineSnappedRef.current = false;
    };

    const handleUndo = () => {
        if (!canvasRef.current) return;
        const data = canvasRef.current.toData();
        if (data && data.length > 0) {
            data.pop(); // remove last stroke
            canvasRef.current.fromData(data);
            if (data.length === 0) {
                setIsEmpty(true);
                onSave('');
            } else {
                onSave(canvasRef.current.toDataURL('image/png'));
            }
        }
    };

    const handleEndStrokeNative = () => {
        // Only saving here, internal tracking is handled by monkey-patch
        setIsEmpty(canvasRef.current.isEmpty());
        if (!canvasRef.current.isEmpty()) {
            onSave(canvasRef.current.toDataURL('image/png'));
        } else {
            onSave('');
        }
    };

    const startHoldTimer = () => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        // Transform to straight line if held for 600ms
        holdTimerRef.current = setTimeout(snapToStraightLine, 600);
    };

    const snapToStraightLine = () => {
        if (!isDrawingRef.current || isLineSnappedRef.current) return;
        if (!canvasRef.current || !canvasRef.current._signaturePad) return;

        const pad = canvasRef.current._signaturePad;
        const rawData = pad._data;
        if (!rawData || rawData.length === 0) return;

        const currentStroke = rawData[rawData.length - 1];
        if (!currentStroke || !currentStroke.points || currentStroke.points.length < 3) return;

        const start = currentStroke.points[0];
        const end = currentStroke.points[currentStroke.points.length - 1];

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Need at least 20 units to form a meaningful line
        if (distance > 20) {
            isLineSnappedRef.current = true;

            // Generate straight line points
            const straightPoints = [];
            const steps = Math.max(10, Math.floor(distance / 5));
            const timeStep = Math.max(10, (end.time - start.time) / steps);

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                straightPoints.push({
                    x: start.x + dx * t,
                    y: start.y + dy * t,
                    time: start.time + (timeStep * i),
                    color: currentStroke.points[0]?.color || penColor,
                });
            }

            // Stop internal drawing smoothly without firing the user-facing onEnd
            pad._strokeEnd(new Event('mouseup'));

            // Fetch clean data array without the noisy trace
            const history = pad.toData() || [];

            // Create pristine stroke replacing original data points
            // Crucial: We must explicitly preserve the stroke's original visual weight so that
            // pad.fromData() doesn't accidentally restyle it using the globally active tool
            const newStroke = {
                minWidth: currentStroke.minWidth || minWidth,
                maxWidth: currentStroke.maxWidth || maxWidth,
                penColor: currentStroke.penColor || currentStroke.points[0]?.color || penColor,
                velocityFilterWeight: currentStroke.velocityFilterWeight || velocityFilterWeight,
                points: straightPoints
            };

            // Replace the last squiggly stroke with the pristine straight line stroke
            if (history.length > 0) {
                history.pop();
            }
            history.push(newStroke);

            // Detach pad events temporarily to avoid glitching during replacement
            pad.off();
            isBlockDrawingRef.current = true;
            setIsBlockDrawing(true);

            // Draw clean line
            pad.fromData(history);

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
