import React, { useEffect } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Printer, ArrowLeft } from 'lucide-react';

export default function PrintView({ quizId, navigateTo }) {
    const { quizzes } = useQuiz();
    const quiz = quizzes.find(q => q.id === quizId);

    // Auto trigger print dialog when component mounts
    useEffect(() => {
        if (quiz) {
            // Optional: small delay to ensure rendering is complete
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [quiz]);

    if (!quiz) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">ไม่พบแบบทดสอบ</p>
                <Button className="mt-4" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
            </div>
        );
    }

    const letters = ['ก', 'ข', 'ค', 'ง'];

    return (
        <div className="bg-white min-h-screen">
            {/* Screen-only Controls (Hidden in Print) */}
            <div className="print:hidden max-w-4xl mx-auto p-4 flex justify-between items-center border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <Button variant="outline" onClick={() => navigateTo('dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> กลับหน้าแรก
                </Button>
                <Button variant="primary" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700">
                    <Printer className="w-4 h-4 mr-2" /> พิมพ์ข้อสอบ
                </Button>
            </div>

            {/* Print Content Area */}
            <div className="max-w-4xl mx-auto p-8 print:p-0 font-serif text-black print:text-black">

                {/* Header section optimized for paper */}
                <div className="text-center mb-8 pb-6 border-b-2 border-slate-800 print:mb-10">
                    <h1 className="text-2xl font-bold mb-2 print:text-3xl">{quiz.title}</h1>
                    {quiz.description && <p className="text-lg italic text-slate-700 print:text-black">{quiz.description}</p>}

                    <div className="flex justify-between items-end mt-8 text-lg font-medium">
                        <div className="flex gap-4 items-center">
                            <span>ชื่อ-สกุล ..........................................................................</span>
                            <span>ชั้น ............</span>
                            <span>เลขที่ .........</span>
                        </div>
                        <div className="text-right">
                            <span>คะแนนที่ได้ ............ / {quiz.questions.filter(q => q.type === 'mcq').length}</span>
                        </div>
                    </div>
                </div>

                {/* Questions List */}
                <div className="space-y-8 print:space-y-12">
                    {quiz.questions.map((q, qIndex) => (
                        <div key={q.id} className="break-inside-avoid">
                            <div className="flex gap-2 text-lg">
                                <span className="font-bold shrink-0">{qIndex + 1}.</span>
                                <div>
                                    <span className="font-medium whitespace-pre-wrap">{q.text}</span>

                                    {q.imageUrl && (
                                        <div className="mt-4 mb-2 max-w-sm mx-auto">
                                            <img src={q.imageUrl} alt="Question Graphic" className="max-w-full h-auto rounded border border-slate-300" />
                                        </div>
                                    )}

                                    {/* MCQ Options */}
                                    {q.type === 'mcq' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mt-4 ml-4">
                                            {q.options.map((opt, oIndex) => (
                                                <div key={oIndex} className="flex gap-3 items-start">
                                                    <span className="font-bold">{letters[oIndex]}.</span>
                                                    <span>{opt}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Essay Answer Space */}
                                    {q.type === 'essay' && (
                                        <div className="mt-6 mb-12">
                                            <p className="text-slate-500 italic mb-2 text-sm">(เขียนคำตอบลงในช่องว่างด้านล่าง)</p>
                                            <div className="border border-slate-400 rounded-lg h-64 w-full border-dashed"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer only visible in print */}
                <div className="hidden print:block text-center mt-12 pt-4 border-t border-slate-300 text-sm text-slate-500">
                    แบบทดสอบนี้สร้างโดยระบบสร้างและจัดการข้อสอบ (Quiz Builder)
                </div>
            </div>
        </div>
    );
}
