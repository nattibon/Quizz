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
    const holdTimerRef = useRef(null);
    const strokeStartRef = useRef(null);
    const lastPointRef = useRef(null);
    const isDrawingRef = useRef(false);
    const isLineSnappedRef = useRef(false);
    const [lineSnapEnabled, setLineSnapEnabled] = useState(true);

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

    const handleBeginStroke = (e) => {
        isDrawingRef.current = true;
        isLineSnappedRef.current = false;

        if (canvasRef.current && canvasRef.current._signaturePad) {
            const pad = canvasRef.current._signaturePad;

            // Get the first point from the pad's active stroke if available
            if (pad._data && pad._data.length > 0) {
                const currentStroke = pad._data[pad._data.length - 1];
                if (currentStroke && currentStroke.points && currentStroke.points.length > 0) {
                    strokeStartRef.current = currentStroke.points[0];
                    lastPointRef.current = currentStroke.points[0];
                }
            }
        }

        startHoldTimer();
    };

    // Use a global pointer move listener while drawing to bypass touch-action issues
    useEffect(() => {
        const handleGlobalPointerMove = (e) => {
            if (!isDrawingRef.current) return;
            if (isLineSnappedRef.current) return;

            if (canvasRef.current && canvasRef.current._signaturePad) {
                const pad = canvasRef.current._signaturePad;

                // try to extract coordinates from standard mouse/touch events
                let clientX, clientY;
                if (e.touches && e.touches.length > 0) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }

                if (clientX === undefined || clientY === undefined) return;

                // Create a basic point 
                const rect = canvasRef.current.getCanvas().getBoundingClientRect();
                const currentPoint = {
                    x: clientX - rect.left,
                    y: clientY - rect.top,
                    time: Date.now()
                };

                if (lastPointRef.current) {
                    const dx = currentPoint.x - lastPointRef.current.x;
                    const dy = currentPoint.y - lastPointRef.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // If moving significantly, reset the hold timer
                    if (dist > 5) {
                        // console.log("Pointer moving... resetting timer. Dist:", dist);
                        startHoldTimer();
                        lastPointRef.current = currentPoint;
                    }
                } else {
                    lastPointRef.current = currentPoint;
                    if (!strokeStartRef.current) {
                        strokeStartRef.current = currentPoint;
                    }
                }
            }
        };

        window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
        window.addEventListener('touchmove', handleGlobalPointerMove, { passive: false });

        return () => {
            window.removeEventListener('pointermove', handleGlobalPointerMove);
            window.removeEventListener('touchmove', handleGlobalPointerMove);
        };
    }, []);

    const startHoldTimer = () => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

        // If held still for 600ms, snap to line
        holdTimerRef.current = setTimeout(() => {
            snapToStraightLine();
        }, 500);
    };

    const snapToStraightLine = () => {
        console.log("Snapping check fired!");
        if (!isDrawingRef.current) {
            console.log("Snap aborted: isDrawing=false");
            return;
        }
        if (isLineSnappedRef.current) {
            console.log("Snap aborted: isLineSnapped=true");
            return;
        }

        if (!canvasRef.current || !canvasRef.current._signaturePad) return;
        if (!strokeStartRef.current || !lastPointRef.current) {
            console.log("Snap aborted: missing start or last point");
            return;
        }

        const pad = canvasRef.current._signaturePad;
        const canvas = canvasRef.current.getCanvas();
        const ctx = canvas.getContext("2d");

        // Grab the internal data array completely
        const rawData = pad.toData();

        if (rawData && rawData.length > 0) {
            // Get the current stroke being drawn (the last one in the array)
            const currentStroke = rawData[rawData.length - 1];

            // Need at least start and end points
            if (currentStroke && currentStroke.points && currentStroke.points.length > 2) {
                // Ensure we use the exact start and end from the stroke data itself
                const start = currentStroke.points[0];
                const end = currentStroke.points[currentStroke.points.length - 1];

                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                console.log("Snap distance calculated:", distance);

                // Only snap if distance is significant enough
                if (distance > 20) {
                    console.log("Snapping to perfect line!");
                    isLineSnappedRef.current = true;

                    // 1. Force pad to end the current stroke
                    pad._strokeEnd(new Event('mouseup'));

                    // 2. Erase the wobbly line by popping it from data and redrawing
                    rawData.pop();

                    // 3. Create a perfect straight line stroke object
                    const straightPoints = [];
                    const steps = Math.max(10, Math.floor(distance / 5));

                    const timeStart = start.time;
                    const timeEnd = end.time;
                    const timeStep = (timeEnd - timeStart) / steps;

                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        straightPoints.push({
                            x: start.x + dx * t,
                            y: start.y + dy * t,
                            time: timeStart + (timeStep * i)
                        });
                    }

                    // 4. Add the straight line to the data
                    rawData.push({
                        ...currentStroke,
                        points: straightPoints
                    });

                    // 5. Redraw canvas cleanly from memory
                    pad.fromData(rawData);

                    // Trigger save
                    handleEndStroke();
                } else {
                    console.log("Line too short to snap");
                }
            } else {
                console.log("Not enough points to snap");
            }
        }
    };

    const handleEndStroke = () => {
        isDrawingRef.current = false;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

        setIsEmpty(canvasRef.current.isEmpty());
        // Auto-save on every stroke finish
        if (!canvasRef.current.isEmpty()) {
            onSave(canvasRef.current.toDataURL('image/png'));
        } else {
            onSave('');
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
                className={`${overlayMode ? `absolute inset-0 mix-blend-multiply z-40 ${isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'}` : 'border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner relative touch-none'} w-full`}
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
                    onBegin={handleBeginStroke}
                    onEnd={handleEndStroke}
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
