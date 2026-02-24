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
            // Cancel any pending hold timer (this is the reliable place to do it)
            if (holdTimerRef.current) {
                clearTimeout(holdTimerRef.current);
                holdTimerRef.current = null;
            }
            isDrawingRef.current = false;
            if (holdStateRef.current) holdStateRef.current = null;

            if (isBlockDrawingRef.current) {
                setIsBlockDrawing(false);
                isBlockDrawingRef.current = false;
                // Small delay to ensure touch events are completely flushed before re-enabling
                setTimeout(() => {
                    if (canvasRef.current) {
                        canvasRef.current.on(); // react-signature-canvas public API
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

    // Block finger touch at the canvas level using capture-phase on touchstart only.
    // Blocking touchstart prevents stroke initiation. touchmove is left alone so
    // signature_pad can still call preventDefault() to block page scroll during stylus strokes.
    useEffect(() => {
        const canvas = canvasRef.current?.getCanvas();
        if (!canvas) return;

        const blockFingerTouchStart = (event) => {
            const touch = event.changedTouches?.[0];
            // Allow Apple Pencil on iOS Safari (touchType === 'stylus')
            if (touch?.touchType === 'stylus') return;
            // Block finger: prevent default (no scroll) and stop signature_pad from drawing
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        canvas.addEventListener('touchstart', blockFingerTouchStart, { capture: true, passive: false });

        return () => {
            canvas.removeEventListener('touchstart', blockFingerTouchStart, { capture: true });
        };
    }, []);

    // --- Monkey-patch SignaturePad to detect holds using its exact native data ---
    // Cleaned up monkey patch logic. Using manual native pointer events now!

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
        if (!canvasRef.current) return;
        const pad = canvasRef.current.getSignaturePad();
        if (!pad) return;

        pad.clear();

        if (bgImageRef.current) {
            const ctx = pad._ctx;
            const canvas = pad._canvas;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const width = canvas.width / ratio;
            const height = canvas.height / ratio;
            ctx.drawImage(bgImageRef.current, 0, 0, width, height);
            pad._isEmpty = false;
        }

        const strokes = cachedStrokesRef.current;
        if (strokes.length === 0) return;

        const ctx = pad._ctx;
        const oldColor = pad.penColor;
        const oldMin = pad.minWidth;
        const oldMax = pad.maxWidth;
        const oldVelocity = pad.velocityFilterWeight;

        // Draw each stroke independently using the pad's internal render pipeline
        // but resetting pad state between strokes to prevent point leakage
        strokes.forEach(stroke => {
            pad.penColor = stroke.penColor;
            pad.minWidth = stroke.minWidth;
            pad.maxWidth = stroke.maxWidth;
            pad.velocityFilterWeight = stroke.velocityFilterWeight;
            ctx.fillStyle = stroke.penColor;

            // Feed ONLY this stroke's points as a single group – _fromData resets 
            // internal bezier state at j===0, so one-group-per-call is clean.
            pad._fromData(
                [stroke.points],
                (curve, widths) => pad._drawCurve(curve, widths.start, widths.end),
                (rawPoint) => pad._drawDot(rawPoint)
            );
        });

        // Restore _data so signature_pad knows what's on canvas
        pad._data = strokes.map(s => s.points);
        pad._isEmpty = false;

        // Restore active tool settings
        pad.penColor = oldColor;
        pad.minWidth = oldMin;
        pad.maxWidth = oldMax;
        pad.velocityFilterWeight = oldVelocity;
        ctx.fillStyle = oldColor;
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
                const pad = canvasRef.current.getSignaturePad();
                if (pad) {
                    pad.clear();
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
        if (!isLineSnappedRef.current && canvasRef.current) {
            const pad = canvasRef.current.getSignaturePad();
            if (pad) {
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
        }

        setIsEmpty(canvasRef.current.isEmpty());
        if (!canvasRef.current.isEmpty()) {
            onSave(canvasRef.current.toDataURL('image/png'));
        } else {
            onSave('');
        }
    };

    const logicRef = useRef({});

    useEffect(() => {
        logicRef.current = {
            snapToStraightLine: () => {
                if (!isDrawingRef.current || isLineSnappedRef.current) return;
                const pad = canvasRef.current ? canvasRef.current.getSignaturePad() : null;
                if (!pad) {
                    return;
                }

                const rawData = pad._data;
                if (!rawData || rawData.length === 0) return;

                const currentStroke = rawData[rawData.length - 1]; // Array of points
                if (!currentStroke || currentStroke.length < 2) return; // Allow 2 point strokes

                const start = currentStroke[0];
                const end = currentStroke[currentStroke.length - 1];

                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 10) {
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

                    // Clear the current in-progress stroke from the pad
                    // We use the react wrapper's public clear() then redrawCustomStrokes redraws
                    // everything cleanly
                    const newStroke = {
                        points: straightPoints,
                        penColor: currentStroke[0]?.color || penColor,
                        minWidth,
                        maxWidth,
                        velocityFilterWeight
                    };

                    cachedStrokesRef.current.push(newStroke);

                    // Disable further drawing until user lifts pointer
                    pad.off();
                    isBlockDrawingRef.current = true;
                    setIsBlockDrawing(true);

                    // Clear the pad completely and redraw from our cache
                    canvasRef.current.clear();
                    redrawCustomStrokes();


                    // Save
                    if (!canvasRef.current.isEmpty()) {
                        onSave(canvasRef.current.toDataURL('image/png'));
                    }
                    setIsEmpty(false);
                }
            }
        };
    }); // no deps array = runs every render, always has fresh closure

    const holdStateRef = useRef(null);

    const handlePointerDown = (e) => {
        // Only allow pen (Apple Pencil / Stylus) or mouse. Reject finger touch.
        if (e.pointerType === 'touch') return;
        if (!isDrawingMode || activeTool === 'eraser' || isBlockDrawing) return;

        isDrawingRef.current = true;
        isLineSnappedRef.current = false;

        // Start tracking position manually capturing DOM events
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            holdStateRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
            if (logicRef.current.snapToStraightLine) {
                logicRef.current.snapToStraightLine();
            }
        }, 500);
    };

    const handlePointerMove = (e) => {
        // Only track pen/mouse, ignore finger touch
        if (e.pointerType === 'touch') return;
        if (!isDrawingRef.current || isLineSnappedRef.current || isBlockDrawing) return;
        if (!holdStateRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const dx = currentX - holdStateRef.current.x;
        const dy = currentY - holdStateRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // If moved more than 20px radius, user is still deliberately gesturing.
        if (dist > 20) {
            holdStateRef.current = { x: currentX, y: currentY };
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = setTimeout(() => {
                if (logicRef.current.snapToStraightLine) {
                    logicRef.current.snapToStraightLine();
                }
            }, 500);
        }
    };

    const handlePointerUp = () => {
        // This is now only called by the local pointer events on the div, not used.
        // All cleanup happens in the global window listener above.
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
                onPointerDownCapture={handlePointerDown}
                onPointerMoveCapture={handlePointerMove}
                onPointerUpCapture={handlePointerUp}
                onPointerCancelCapture={handlePointerUp}
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
                        style: {
                            display: 'block',
                            touchAction: 'none',
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent'
                        }
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


