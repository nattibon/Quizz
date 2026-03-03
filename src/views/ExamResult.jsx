import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Trophy, ArrowLeft, CheckCircle2, XCircle, FileText, Lightbulb, Link2, Check, X, RefreshCw, Printer } from 'lucide-react';
import { useQuiz } from '../context/QuizContext';
import MaterialViewerModal from '../components/ui/MaterialViewerModal';

export default function ExamResult({ result, navigateTo }) {
    const { quizzes } = useQuiz();
    const [hintMaterial, setHintMaterial] = useState(null);

    const quiz = quizzes.find(q => q.id === result?.quizId);

    if (!result || !quiz) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">ไม่พบผลคะแนน</p>
                <Button className="mt-4" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
            </div>
        );
    }

    const { quizTitle, studentName, mcqScore, mcqDetails, subjectiveAnswers } = result;

    let scoreColor = 'text-primary-600';
    let scoreBg = 'bg-primary-50';
    let borderCol = 'border-primary-200';
    if (mcqScore.percentage >= 80) {
        scoreColor = 'text-emerald-600';
        scoreBg = 'bg-emerald-50';
        borderCol = 'border-emerald-200';
    } else if (mcqScore.percentage < 50) {
        scoreColor = 'text-red-600';
        scoreBg = 'bg-red-50';
        borderCol = 'border-red-200';
    }

    const handlePrint = () => window.print();

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-16">
            {/* Score Summary */}
            <div className="text-center space-y-5 bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 text-amber-500 mb-2 shadow-inner border-[6px] border-amber-50">
                    <Trophy className="w-12 h-12" />
                </div>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">ทำข้อสอบเสร็จสิ้น!</h2>
                <p className="text-xl text-slate-600 font-medium">{quizTitle}</p>
                {studentName && studentName !== 'ไม่ระบุชื่อ' && (
                    <p className="text-base text-slate-500">ผู้สอบ: <span className="font-semibold text-slate-700">{studentName}</span></p>
                )}

                {mcqScore.total > 0 && (
                    <div className={`mt-8 inline-block px-10 py-8 rounded-3xl border-2 ${scoreBg} ${borderCol} shadow-sm`}>
                        <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">คะแนนปรนัยของคุณ</div>
                        <div className="flex items-baseline justify-center gap-2">
                            <span className={`text-6xl font-black ${scoreColor} drop-shadow-sm`}>
                                {mcqScore.percentage}%
                            </span>
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-4 text-lg font-medium">
                            <span className="text-slate-600 flex items-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" /> ตอบถูก {mcqScore.correct}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-600">เต็ม {mcqScore.total} ข้อ</span>
                        </div>
                    </div>
                )}
            </div>

            {/* MCQ Review */}
            {mcqDetails && mcqDetails.length > 0 && (
                <div className="space-y-6 pt-4">
                    <div className="flex items-center gap-3 mb-6 p-4 bg-slate-100 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-primary-600" />
                        <h3 className="text-2xl font-bold text-slate-900">ทบทวนข้อสอบปรนัย</h3>
                    </div>
                    <div className="space-y-6">
                        {mcqDetails.map((item, idx) => (
                            <Card key={item.questionId} className={`border-2 ${item.isCorrect ? 'border-emerald-200' : 'border-red-200'} overflow-hidden shadow-sm`}>
                                <div className={`${item.isCorrect ? 'bg-emerald-50' : 'bg-red-50'} py-4 px-6 border-b ${item.isCorrect ? 'border-emerald-100' : 'border-red-100'} flex items-start gap-3`}>
                                    <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white ${item.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                        {item.isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                    </div>
                                    <h4 className={`font-bold text-lg ${item.isCorrect ? 'text-emerald-900' : 'text-red-900'}`}>
                                        {idx + 1}. {item.questionText}
                                    </h4>
                                </div>
                                <CardContent className="p-6 bg-white space-y-4">
                                    {/* Question Image */}
                                    {item.imageUrl && (
                                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                            <img src={item.imageUrl} alt="รูปประกอบคำถาม" className="w-full max-h-56 object-contain" />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <p className="text-sm font-semibold text-slate-500 mb-2">คำตอบของคุณ:</p>
                                            <p className={`text-base font-medium ${item.isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                                                {item.userAnswerIndex !== undefined
                                                    ? item.options[item.userAnswerIndex]
                                                    : <span className="italic text-slate-400">ข้าม / ไม่ได้ตอบ</span>}
                                            </p>
                                        </div>
                                        {!item.isCorrect && (
                                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                                                <p className="text-sm font-semibold text-emerald-600 mb-2">เฉลยที่ถูกต้อง:</p>
                                                <p className="text-base font-medium text-emerald-800 flex items-center">
                                                    <CheckCircle2 className="w-4 h-4 mr-2" /> {item.options[item.correctAnswerIndex]}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {item.explanation && (
                                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                                            <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold">
                                                <Lightbulb className="w-5 h-5 text-amber-500" /> คำอธิบายเฉลย
                                            </div>
                                            <p className="text-amber-900 leading-relaxed">{item.explanation}</p>
                                        </div>
                                    )}
                                    {item.linkedMaterialId && (
                                        <div className="flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                                onClick={() => {
                                                    const material = quiz.materials?.find(m => m.id === item.linkedMaterialId);
                                                    if (material) setHintMaterial(material);
                                                }}
                                            >
                                                <Link2 className="w-4 h-4 mr-1.5" /> ทบทวนเนื้อหาข้อนี้
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Subjective Review */}
            {subjectiveAnswers.length > 0 && (
                <div className="space-y-6 pt-8 border-t-2 border-slate-200">
                    <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 rounded-xl">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        <div>
                            <h3 className="text-2xl font-bold text-indigo-900">ทบทวนข้อสอบอัตนัย</h3>
                            <p className="text-indigo-700 mt-1 font-medium">เปรียบเทียบคำตอบของคุณกับแนวทางการตอบ</p>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {subjectiveAnswers.map((item, idx) => (
                            <Card key={item.questionId} className="border-indigo-200 overflow-hidden shadow-sm">
                                <div className="bg-indigo-600 py-4 px-6">
                                    <h4 className="font-bold text-indigo-50 mb-1">ข้อที่ {idx + 1}</h4>
                                    <p className="text-white text-lg font-medium">{item.questionText}</p>
                                </div>
                                <CardContent className="p-0">
                                    {/* Question Image */}
                                    {item.imageUrl && (
                                        <div className="px-6 pt-4">
                                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                                <img src={item.imageUrl} alt="รูปประกอบคำถาม" className="w-full max-h-56 object-contain" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-slate-100">
                                        <div className="p-6 bg-slate-50">
                                            <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">คำตอบของคุณ</div>
                                            <div className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                                                {item.userDrawingUrl ? (
                                                    <div className="bg-white border-2 border-slate-200 rounded-lg p-2 flex justify-center w-full">
                                                        <img src={item.userDrawingUrl} alt="คำตอบที่วาด" className="max-w-full max-h-[300px] object-contain rounded-md" />
                                                    </div>
                                                ) : (
                                                    item.userAnswer || <span className="text-slate-400 italic">ไม่ได้ตอบคำถามนี้</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-6 bg-white">
                                            <div className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5" /> แนวการตอบ (Model Answer)
                                            </div>
                                            <div className="text-slate-800 whitespace-pre-wrap font-medium leading-relaxed">
                                                {item.modelAnswer || <span className="text-slate-400 italic">ไม่มีการกำหนดแนวการตอบ</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {item.explanation && (
                                        <div className="m-6 mt-0 bg-amber-50 p-5 rounded-xl border border-amber-200">
                                            <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold">
                                                <Lightbulb className="w-5 h-5 text-amber-500" /> คำอธิบายเพิ่มเติม
                                            </div>
                                            <p className="text-amber-900 leading-relaxed">{item.explanation}</p>
                                        </div>
                                    )}
                                    {item.linkedMaterialId && (
                                        <div className="m-6 mt-0 flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                                onClick={() => {
                                                    const material = quiz.materials?.find(m => m.id === item.linkedMaterialId);
                                                    if (material) setHintMaterial(material);
                                                }}
                                            >
                                                <Link2 className="w-4 h-4 mr-1.5" /> ทบทวนเนื้อหาข้อนี้
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-4 pt-10 pb-6 border-t border-slate-200">
                <Button
                    variant="outline"
                    size="lg"
                    className="px-6"
                    onClick={handlePrint}
                >
                    <Printer className="w-5 h-5 mr-2" /> พิมพ์ผลลัพธ์
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    className="px-6 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    onClick={() => navigateTo('exam', { quizId: result.quizId })}
                >
                    <RefreshCw className="w-5 h-5 mr-2" /> ทำข้อสอบใหม่
                </Button>
                <Button
                    variant="primary"
                    size="lg"
                    className="px-8 shadow-md"
                    onClick={() => navigateTo('dashboard')}
                >
                    <ArrowLeft className="w-5 h-5 mr-2" /> กลับหน้าแบบทดสอบ
                </Button>
            </div>

            <MaterialViewerModal
                isOpen={!!hintMaterial}
                material={hintMaterial}
                onClose={() => setHintMaterial(null)}
            />
        </div>
    );
}
