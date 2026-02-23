import React, { useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { ArrowLeft, Play, LayoutList, Image as ImageIcon, Video, Trash2, Plus, Pen, BookOpen } from 'lucide-react';
import DrawingCanvas from '../components/ui/DrawingCanvas';

export default function StudyMode({ quizId, navigateTo }) {
    const { quizzes } = useQuiz();
    const quiz = quizzes.find(q => q.id === quizId);

    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [slideNotes, setSlideNotes] = useState({}); // Stores drawn data URLs per slide index
    const [isDrawingMode, setIsDrawingMode] = useState(false);

    if (!quiz) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">ไม่พบเอกสารติวนี้</p>
                <Button className="mt-4" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
            </div>
        );
    }

    const materials = quiz.materials || [];

    if (materials.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300 max-w-3xl mx-auto">
                <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                    <LayoutList className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">ยังไม่มีเนื้อหาเตรียมตัวสอบ</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    ผู้สอนยังไม่ได้เพิ่มเอกสาร สไลด์ หรือรูปภาพประกอบการติวสำหรับแบบทดสอบชุดนี้ คุณสามารถข้ามไปทำข้อสอบได้เลย
                </p>
                <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
                    <Button variant="primary" onClick={() => navigateTo('exam', { quizId: quiz.id })}>
                        <Play className="w-4 h-4 mr-2" /> ข้ามไปทำข้อสอบ
                    </Button>
                </div>
            </div>
        );
    }

    const currentMaterial = materials[currentSlideIndex];
    const isFirstSlide = currentSlideIndex === 0;
    const isLastSlide = currentSlideIndex === materials.length - 1;

    const handleNext = () => !isLastSlide && setCurrentSlideIndex(prev => prev + 1);
    const handlePrev = () => !isFirstSlide && setCurrentSlideIndex(prev => prev - 1);

    const handleDrawingChange = (dataUrl) => {
        setSlideNotes({
            ...slideNotes,
            [currentSlideIndex]: dataUrl
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{quiz.title} - เอกสารและเนื้อหาการติว</h2>
                    <p className="text-slate-500 mt-1">ศึกษาเนื้อหาและเลื่อนดูสไลด์ทั้งหมดก่อนเริ่มทำข้อสอบ</p>
                </div>
                <Button variant="outline" onClick={() => navigateTo('dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> ออกจากการติว
                </Button>
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide hidden sm:inline-block">หน้า {currentSlideIndex + 1} จาก {materials.length}</span>
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-colors ${!isDrawingMode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setIsDrawingMode(false)}
                    >
                        <BookOpen className="w-4 h-4" /> โหมดอ่าน
                    </button>
                    <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-colors ${isDrawingMode ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={() => setIsDrawingMode(true)}
                    >
                        <Pen className="w-4 h-4" /> โหมดขีดเขียน
                    </button>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrev} disabled={isFirstSlide}>ก่อนหน้า</Button>
                    <Button variant="outline" size="sm" onClick={handleNext} disabled={isLastSlide}>ถัดไป</Button>
                </div>
            </div>

            <Card className="min-h-[500px] flex flex-col justify-start items-center relative shadow-md border-slate-200 bg-white overflow-hidden">
                {/* Content Container */}
                <div className={`w-full max-w-4xl flex flex-col gap-6 p-8 ${isDrawingMode ? 'pointer-events-none select-none' : ''}`}>
                    {/* Title */}
                    {currentMaterial.title && (
                        <h3 className="text-2xl font-bold text-slate-900 mb-2 border-b pb-4 text-center">
                            {currentMaterial.title}
                        </h3>
                    )}

                    {/* Image (supporting both new imageUrl and old 'image' type content) */}
                    {(currentMaterial.imageUrl || (currentMaterial.type === 'image' && currentMaterial.content)) && (
                        <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-center">
                            <img
                                src={currentMaterial.imageUrl || currentMaterial.content}
                                alt={currentMaterial.title || "Study Material"}
                                className="max-h-[500px] max-w-full object-contain rounded-lg shadow-sm"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Image+Not+Found';
                                }}
                            />
                        </div>
                    )}

                    {/* Text Content */}
                    {(currentMaterial.content && currentMaterial.type !== 'embed' && currentMaterial.type !== 'image') && (
                        <div className="text-lg text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {currentMaterial.content}
                        </div>
                    )}

                    {/* Embed Video/Slide (supporting both new embedUrl and old 'embed' type content) */}
                    {(currentMaterial.embedUrl || (currentMaterial.type === 'embed' && currentMaterial.content)) && (
                        <div className="w-full flex justify-center mt-4">
                            <div className="w-full max-w-3xl aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                                <iframe
                                    src={currentMaterial.embedUrl || currentMaterial.content}
                                    className="w-full h-full border-0"
                                    allowFullScreen
                                    title={currentMaterial.title || "Embed"}
                                ></iframe>
                            </div>
                        </div>
                    )}

                    {/* We no longer show the scratchpad here. It is an overlay below. */}
                </div>

                {/* Drawing Overlay */}
                <DrawingCanvas
                    key={`study-canvas-${currentSlideIndex}`}
                    initialDataUrl={slideNotes[currentSlideIndex] || ''}
                    onSave={handleDrawingChange}
                    overlayMode={true}
                    isDrawingMode={isDrawingMode}
                />
            </Card>

            <div className="flex justify-end pt-4">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-md text-base px-8" onClick={() => navigateTo('exam', { quizId: quiz.id })}>
                    <Play className="w-5 h-5 mr-2" /> เข้าสู่การทำข้อสอบ (เริ่มสอบ)
                </Button>
            </div>
        </div>
    );
}
