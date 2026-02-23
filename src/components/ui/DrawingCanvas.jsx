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

    const colors = [
        { name: 'ดำ (Black)', value: '#0f172a', bgClass: 'bg-slate-900' },
        { name: 'น้ำเงิน (Blue)', value: '#2563eb', bgClass: 'bg-blue-600' },
        { name: 'แดง (Red)', value: '#dc2626', bgClass: 'bg-red-600' },
        { name: 'เขียว (Green)', value: '#16a34a', bgClass: 'bg-green-600' },
    ];

    // Determine current canvas properties based on tool and color
    let penColor = currentColor;
    let minWidth = 1.5;
    let maxWidth = 4;
    let velocityFilterWeight = 0.7;

    if (activeTool === 'highlighter') {
        const rgbMap = {
            '#0f172a': '15, 23, 42',
            '#2563eb': '37, 99, 235',
            '#dc2626': '220, 38, 38',
            '#16a34a': '22, 163, 74'
        };
        const rgb = rgbMap[currentColor] || '15, 23, 42';
        penColor = `rgba(${rgb}, 0.15)`; // 15% opacity for highlighter so it doesn't obscure text
        minWidth = 14;
        maxWidth = 20;
        velocityFilterWeight = 0; // Less smoothing to feel more like a marker
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

                // Update internal resolution to match display size exactly
                canvas.width = containerRef.current.offsetWidth * ratio;
                canvas.height = containerRef.current.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);

                canvasRef.current.clear();
                // Restore drawing
                if (data && data.length > 0) {
                    canvasRef.current.fromData(data);
                }
            }
        };

        // Delay slighty to ensure container has rendered its width
        setTimeout(resizeCanvas, 100);
        window.addEventListener("resize", resizeCanvas);

        return () => window.removeEventListener("resize", resizeCanvas);
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
        canvasRef.current.clear();
        setIsEmpty(true);
        onSave(''); // Clear saved data
    };

    const handleUndo = () => {
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

    const handleEndStroke = () => {
        setIsEmpty(canvasRef.current.isEmpty());
        // Auto-save on every stroke finish
        if (!canvasRef.current.isEmpty()) {
            onSave(canvasRef.current.toDataURL('image/png'));
        } else {
            onSave('');
        }
    };

    if (overlayMode && !isDrawingMode) {
        return null; // Hidden when not in drawing mode and acts as an overlay
    }

    return (
        <div className={`flex flex-col gap-3 w-full ${overlayMode ? 'absolute inset-0 z-50 pointer-events-none' : ''}`}>
            {/* Toolbar */}
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1 border-b border-slate-100 pb-3 ${overlayMode ? 'pointer-events-auto bg-white/90 backdrop-blur-sm p-3 rounded-b-xl shadow-sm border border-slate-200 mt-2 mx-4 sticky top-4' : ''}`}>
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

            <div ref={containerRef} className={`${overlayMode ? 'flex-1 pointer-events-auto' : 'border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner relative w-full touch-none'} w-full`} style={overlayMode ? {} : { height: '500px' }}>
                <SignatureCanvas
                    ref={canvasRef}
                    penColor={penColor}
                    velocityFilterWeight={velocityFilterWeight}
                    minWidth={minWidth}
                    maxWidth={maxWidth}
                    canvasProps={{
                        className: 'w-full h-full cursor-crosshair touch-none',
                        style: { display: 'block' }
                    }}
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
