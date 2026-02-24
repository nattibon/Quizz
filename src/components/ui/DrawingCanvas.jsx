import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Eraser, Undo, RefreshCcw, PenTool, Highlighter } from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Pure Canvas2D drawing engine – no signature_pad internals.
// All event handling uses PointerEvents (works on Android,
// iOS Apple Pencil, and desktop mouse / trackpad).
// ──────────────────────────────────────────────────────────

export default function DrawingCanvas({ initialDataUrl, onSave, overlayMode = false, isDrawingMode = true }) {
    // ── Refs ──────────────────────────────────────────────
    const canvasRef = useRef(null);   // raw <canvas>
    const containerRef = useRef(null);
    const ctxRef = useRef(null);   // canvas 2D context

    // current live-stroke points collected between pointerdown → pointerup
    const currentStrokeRef = useRef([]);
    // all completed strokes for undo / redraw
    const strokesRef = useRef([]);
    // background image from initialDataUrl
    const bgImageRef = useRef(null);

    // current tool style (populated in getToolStyle())
    const toolStyleRef = useRef({});

    // straight-line snap state
    const isDrawingRef = useRef(false);
    const isSnappedRef = useRef(false);
    const holdTimerRef = useRef(null);
    const holdOriginRef = useRef(null);
    const canvasRectRef = useRef(null);   // cached rect to avoid reflows during drawing
    const smoothedPtRef = useRef(null);   // last smoothed point for EMA input filter

    // block-drawing after snap until pointer up
    const isBlockedRef = useRef(false);

    // ── State ─────────────────────────────────────────────
    const [isEmpty, setIsEmpty] = useState(true);
    const [activeTool, setActiveTool] = useState('pen');
    const [currentColor, setCurrentColor] = useState('#0f172a');
    const [isBlocked, setIsBlocked] = useState(false);

    // ── Tool config ───────────────────────────────────────
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

    const highlighterMap = {
        '#0f172a': '#fde047', '#2563eb': '#93c5fd', '#dc2626': '#fca5a5',
        '#16a34a': '#86efac', '#9333ea': '#d8b4fe', '#db2777': '#fbcfe8',
        '#ea580c': '#fdba74', '#0d9488': '#5eead4',
    };

    const getToolStyle = useCallback(() => {
        if (activeTool === 'highlighter') {
            return { color: highlighterMap[currentColor] || '#fde047', lineWidth: 18, alpha: 0.45 };
        }
        if (activeTool === 'eraser') {
            return { color: '#ffffff', lineWidth: 22, alpha: 1, composite: 'destination-out' };
        }
        return { color: currentColor, lineWidth: 3, alpha: 1 };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTool, currentColor]);

    // ── Canvas drawing helpers ────────────────────────────

    /** Fully redraw from the strokes cache onto the canvas. */
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (bgImageRef.current) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            ctx.drawImage(bgImageRef.current, 0, 0, canvas.width / ratio, canvas.height / ratio);
        }

        for (const stroke of strokesRef.current) {
            drawStroke(ctx, stroke.points, stroke.style);
        }
    }, []);

    /** Draw a single stroke's points using a smooth quadratic bezier mid-point algorithm. */
    function drawStroke(ctx, pts, style) {
        if (!pts || pts.length === 0) return;
        ctx.save();
        ctx.globalAlpha = style.alpha ?? 1;
        ctx.globalCompositeOperation = style.composite ?? 'source-over';
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        if (pts.length === 1) {
            // Single tap → filled dot
            ctx.arc(pts[0].x, pts[0].y, style.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = style.color;
            ctx.fill();
        } else {
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                const mx = (pts[i].x + pts[i + 1].x) / 2;
                const my = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
            }
            const last = pts[pts.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /** Append a single point to an in-progress stroke, drawing just the new segment. */
    function drawLivePoint(pt, pts, style) {
        const ctx = ctxRef.current;
        if (!ctx) return;
        pts.push(pt);
        const n = pts.length;
        if (n < 2) return;

        ctx.save();
        ctx.globalAlpha = style.alpha ?? 1;
        ctx.globalCompositeOperation = style.composite ?? 'source-over';
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        if (n === 2) {
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
        } else {
            // extend the existing smooth path
            const prev = pts[n - 3], cur = pts[n - 2], next = pts[n - 1];
            const mx1 = (prev.x + cur.x) / 2, my1 = (prev.y + cur.y) / 2;
            const mx2 = (cur.x + next.x) / 2, my2 = (cur.y + next.y) / 2;
            ctx.moveTo(mx1, my1);
            ctx.quadraticCurveTo(cur.x, cur.y, mx2, my2);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ── Resize & Init ─────────────────────────────────────
    const resizeCanvas = useCallback(() => {
        if (isDrawingRef.current) return; // never resize mid-stroke
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const w = container.offsetWidth;
        const h = container.offsetHeight;

        canvas.width = w * ratio;
        canvas.height = h * ratio;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);
        ctxRef.current = ctx;
        redraw();
    }, [redraw]);

    // On mount: size + listen for resize
    useEffect(() => {
        const id = setTimeout(resizeCanvas, 0);
        window.addEventListener('resize', resizeCanvas);
        return () => { window.removeEventListener('resize', resizeCanvas); clearTimeout(id); };
    }, [resizeCanvas]);

    // Load initialDataUrl as background
    useEffect(() => {
        if (!initialDataUrl) return;
        const img = new Image();
        img.onload = () => {
            bgImageRef.current = img;
            redraw();
            setIsEmpty(false);
        };
        img.src = initialDataUrl;
    }, [initialDataUrl, redraw]);

    // ── Save helper ───────────────────────────────────────
    const saveCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const empty = strokesRef.current.length === 0 && !bgImageRef.current;
        setIsEmpty(empty);
        onSave(empty ? '' : canvas.toDataURL('image/png'));
    }, [onSave]);

    // ── Pointer events ────────────────────────────────────
    // Cache the canvas rect once on pointer-down to avoid per-frame reflows in move handler
    const getCanvasPoint = (e) => {
        const r = canvasRectRef.current ?? canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const handlePointerDown = (e) => {
        if (e.pointerType === 'touch') return;  // reject fingers
        if (!isDrawingMode) return;
        if (isBlockedRef.current) return;

        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }

        // Cache rect NOW so handlePointerMove never forces a reflow during drawing
        canvasRectRef.current = canvasRef.current.getBoundingClientRect();
        // Reset EMA smoother for fresh stroke
        smoothedPtRef.current = null;

        toolStyleRef.current = getToolStyle();
        isDrawingRef.current = true;
        isSnappedRef.current = false;
        const pt = getCanvasPoint(e);
        currentStrokeRef.current = [pt];

        // Start hold timer for snap-to-line
        if (activeTool !== 'eraser') {
            holdOriginRef.current = pt;
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = setTimeout(snapToLine, 500);
        }
    };

    const handlePointerMove = (e) => {
        if (e.pointerType === 'touch') return;
        if (!isDrawingRef.current || isSnappedRef.current || isBlockedRef.current) return;

        // Use coalesced events for full hardware resolution
        const rawEvents = (e.nativeEvent?.getCoalescedEvents?.() ?? [e.nativeEvent ?? e]);
        // Refresh rect once per frame (not once per session) so zoom changes don't break coordinates
        canvasRectRef.current = canvasRef.current.getBoundingClientRect();
        const r = canvasRectRef.current;
        // Exponential Moving Average smoothing (alpha=0.35: lower = smoother, higher = more responsive)
        const ALPHA = 0.35;
        for (const re of rawEvents) {
            const raw = { x: re.clientX - r.left, y: re.clientY - r.top };
            // Lerp toward the raw point – kills jitter while keeping the curve feeling natural
            if (!smoothedPtRef.current) {
                smoothedPtRef.current = raw;
            } else {
                smoothedPtRef.current = {
                    x: smoothedPtRef.current.x + ALPHA * (raw.x - smoothedPtRef.current.x),
                    y: smoothedPtRef.current.y + ALPHA * (raw.y - smoothedPtRef.current.y),
                };
            }
            drawLivePoint({ ...smoothedPtRef.current }, currentStrokeRef.current, toolStyleRef.current);
        }

        // Reset hold-timer if stylus moves significantly
        if (activeTool !== 'eraser' && holdOriginRef.current) {
            const pt = getCanvasPoint(e);
            const dx = pt.x - holdOriginRef.current.x;
            const dy = pt.y - holdOriginRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 20) {
                holdOriginRef.current = pt;
                if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                holdTimerRef.current = setTimeout(snapToLine, 500);
            }
        }
    };

    const handlePointerUp = (e) => {
        if (e.pointerType === 'touch') return;

        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }

        if (isBlockedRef.current) {
            isBlockedRef.current = false;
            setIsBlocked(false);
            return;
        }

        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (isSnappedRef.current) {
            isSnappedRef.current = false;
            return;
        }

        // Commit stroke
        const pts = currentStrokeRef.current;
        if (pts.length > 0) {
            strokesRef.current.push({ points: pts, style: { ...toolStyleRef.current } });
            currentStrokeRef.current = [];
            saveCanvas();
        }
    };

    // ── Snap to straight line ─────────────────────────────
    const snapToLine = useCallback(() => {
        if (!isDrawingRef.current || isSnappedRef.current) return;
        const pts = currentStrokeRef.current;
        if (!pts || pts.length < 2) return;

        const start = pts[0];
        const end = pts[pts.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) return;

        isSnappedRef.current = true;

        // Build perfectly straight point array
        const steps = Math.max(10, Math.floor(dist / 5));
        const linePts = Array.from({ length: steps + 1 }, (_, i) => ({
            x: start.x + dx * (i / steps),
            y: start.y + dy * (i / steps),
        }));

        // Redraw everything + the snapped line preview
        redraw();
        drawStroke(ctxRef.current, linePts, toolStyleRef.current);

        // Commit it
        strokesRef.current.push({ points: linePts, style: { ...toolStyleRef.current } });
        currentStrokeRef.current = [];

        // Block further drawing until pen lifts
        isBlockedRef.current = true;
        setIsBlocked(true);
        isDrawingRef.current = false;

        saveCanvas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redraw, saveCanvas]);

    // ── Undo / Clear ──────────────────────────────────────
    const handleUndo = () => {
        if (strokesRef.current.length === 0) return;
        strokesRef.current.pop();
        redraw();
        saveCanvas();
    };

    const handleClear = () => {
        strokesRef.current = [];
        bgImageRef.current = null;
        currentStrokeRef.current = [];
        redraw();
        setIsEmpty(true);
        onSave('');
    };

    // ── getCursorStyle ────────────────────────────────────
    const getCursorStyle = () => {
        if (!isDrawingMode) return 'default';
        if (activeTool === 'eraser') return 'cell';
        return 'crosshair';
    };

    // ── Render ────────────────────────────────────────────
    return (
        <div className={`w-full ${overlayMode ? 'absolute inset-0 pointer-events-none' : 'flex flex-col gap-3'}`}>
            {/* Toolbar */}
            {(!overlayMode || isDrawingMode) && (
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${overlayMode ? 'bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 mt-4 mx-4 relative z-50 pointer-events-auto ring-1 ring-slate-900/5' : 'px-1 border-b border-slate-100 pb-3'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Tool Picker */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setActiveTool('pen')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'pen' ? 'bg-white shadow-sm text-primary-600 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ปากกา (Pen)"><PenTool size={18} /></button>
                            <button type="button" onClick={() => setActiveTool('highlighter')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'highlighter' ? 'bg-white shadow-sm text-amber-500 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ไฮไลต์ (Highlighter)"><Highlighter size={18} /></button>
                            <button type="button" onClick={() => setActiveTool('eraser')}
                                className={`p-2 rounded-md flex items-center transition-colors ${activeTool === 'eraser' ? 'bg-white shadow-sm text-pink-500 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                title="ยางลบ (Eraser)"><Eraser size={18} /></button>
                        </div>

                        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                        {/* Color Picker */}
                        <div className="flex gap-2 items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            {colors.map(c => (
                                <button key={c.value} type="button"
                                    onClick={() => { setCurrentColor(c.value); if (activeTool === 'eraser') setActiveTool('pen'); }}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 ${currentColor === c.value && activeTool !== 'eraser' ? 'scale-125 border-primary-300' : 'border-transparent hover:scale-110'} ${c.bgClass} shadow-sm`}
                                    title={c.name} aria-label={`เลือกสี ${c.name}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                        <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={isEmpty}
                            className="text-slate-600 hover:text-slate-900">
                            <Undo className="w-4 h-4 mr-1.5" /> ย้อนกลับ
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isEmpty}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700">
                            <RefreshCcw className="w-4 h-4 mr-1.5" /> ล้าง
                        </Button>
                    </div>
                </div>
            )}

            {/* Canvas container */}
            <div
                ref={containerRef}
                className={`${overlayMode
                    ? `absolute inset-0 mix-blend-multiply z-40 ${isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'}`
                    : 'border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner relative'
                    } w-full`}
                style={overlayMode ? {} : { height: '500px' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        // Allow browser to handle finger scroll + pinch-zoom natively.
                        // Our pointer handlers already reject touch (finger) events,
                        // so the stylus still draws correctly while fingers can scroll freely.
                        touchAction: isDrawingMode ? 'pan-x pan-y pinch-zoom' : 'auto',
                        cursor: getCursorStyle(),
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                />
            </div>

            {!overlayMode && (
                <p className="text-xs text-slate-400 text-right pr-2 mt-1">
                    รองรับปากกา Stylus และเมาส์ ระบบจะบันทึกอัตโนมัติเมื่อวาดเสร็จ
                </p>
            )}
        </div>
    );
}
