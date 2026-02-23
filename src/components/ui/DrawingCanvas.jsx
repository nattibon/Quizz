import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './Button';
import { Eraser, Undo, RefreshCcw, Save } from 'lucide-react';

export default function DrawingCanvas({ initialDataUrl, onSave }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);

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

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex justify-between items-center px-1">
                <span className="text-sm font-medium text-slate-500">พื้นที่สำหรับวาด/เขียนคำตอบ (ใช้เมาส์ นิ้ว หรือปากกา Stylus)</span>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUndo}
                        disabled={isEmpty}
                        className="text-slate-600 hover:text-slate-900"
                    >
                        <Undo className="w-4 h-4 mr-1.5" /> ย้อนกลับ (Undo)
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        disabled={isEmpty}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        <RefreshCcw className="w-4 h-4 mr-1.5" /> ล้างทั้งหมด
                    </Button>
                </div>
            </div>

            <div ref={containerRef} className="border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner relative w-full touch-none" style={{ height: '400px' }}>
                <SignatureCanvas
                    ref={canvasRef}
                    penColor="black"
                    velocityFilterWeight={0.7}
                    minWidth={1.5}
                    maxWidth={4}
                    canvasProps={{
                        className: 'w-full h-full cursor-crosshair touch-none',
                        style: { display: 'block' }
                    }}
                    onEnd={handleEndStroke}
                />
            </div>

            <p className="text-xs text-slate-400 text-right pr-2">ระบบจะบันทึกลายมือของคุณอัตโนมัติ</p>
        </div>
    );
}
