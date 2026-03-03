import React, { useState, useEffect, useRef } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Textarea, Input } from '../components/ui/Input';
import { ArrowLeft, ArrowRight, Check, Send, Type, Pen, Lightbulb, Clock, User, AlertTriangle } from 'lucide-react';
import DrawingCanvas from '../components/ui/DrawingCanvas';
import MaterialViewerModal from '../components/ui/MaterialViewerModal';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export default function ExamMode({ quizId, navigateTo }) {
    const { quizzes, recordHistory } = useQuiz();
    const quiz = quizzes.find(q => q.id === quizId);

    const [studentName, setStudentName] = useState('');
    const [isExamStarted, setIsExamStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [examQuestions, setExamQuestions] = useState([]);
    const [essayInputModes, setEssayInputModes] = useState({});
    const [hintMaterial, setHintMaterial] = useState(null);

    // Modal states
    const [showTimeoutModal, setShowTimeoutModal] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [unansweredNums, setUnansweredNums] = useState([]);

    // Initialize exam questions (shuffle + subset)
    useEffect(() => {
        if (quiz && quiz.questions.length > 0) {
            let prepared = [...quiz.questions];

            if (quiz.shuffleQuestions) {
                prepared = shuffleArray(prepared);
            }

            // Apply numQuestionsToShow (random subset)
            const limit = parseInt(quiz.numQuestionsToShow) || 0;
            if (limit > 0 && limit < prepared.length) {
                prepared = prepared.slice(0, limit);
            }

            // Shuffle options for MCQ
            prepared = prepared.map(q => {
                if (q.type === 'mcq' && quiz.shuffleOptions) {
                    const optionsWithIndex = q.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
                    return { ...q, shuffledDisplayOptions: shuffleArray(optionsWithIndex) };
                }
                return q;
            });

            setExamQuestions(prepared);
        }
    }, [quiz]);

    // Timer logic
    useEffect(() => {
        if (isExamStarted && quiz?.timeLimitMinutes > 0) {
            setTimeLeft(quiz.timeLimitMinutes * 60);

            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        setShowTimeoutModal(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isExamStarted, quiz]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isExamStarted || showSubmitModal || showTimeoutModal) return;

        const handleKeyDown = (e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

            const curQ = examQuestions[currentQuestionIndex];
            if (!curQ) return;

            if (e.key === 'ArrowLeft') {
                setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight') {
                setCurrentQuestionIndex(prev => Math.min(examQuestions.length - 1, prev + 1));
            } else if (['1', '2', '3', '4'].includes(e.key) && curQ.type === 'mcq') {
                const numIdx = parseInt(e.key) - 1;
                const opts = curQ.shuffledDisplayOptions ||
                    curQ.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
                if (opts[numIdx]) {
                    setAnswers(prev => ({ ...prev, [curQ.id]: opts[numIdx].originalIndex }));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExamStarted, currentQuestionIndex, examQuestions, showSubmitModal, showTimeoutModal]);

    if (!quiz) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">ไม่พบแบบทดสอบชุดนี้</p>
                <Button className="mt-4" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
            </div>
        );
    }

    if (quiz.questions.length === 0 || examQuestions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">แบบทดสอบนี้ยังไม่มีคำถาม</p>
                <Button className="mt-4" onClick={() => navigateTo('editor', { quizId })}>ไปหน้าแก้ไข</Button>
            </div>
        );
    }

    const currentQuestion = examQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;

    const handleAnswerSelect = (originalIndex) => {
        setAnswers({ ...answers, [currentQuestion.id]: originalIndex });
    };

    const handleTextAnswerChange = (e) => {
        setAnswers({
            ...answers,
            [currentQuestion.id]: { ...(answers[currentQuestion.id] || {}), text: e.target.value }
        });
    };

    const handleDrawingChange = (dataUrl) => {
        setAnswers({
            ...answers,
            [currentQuestion.id]: { ...(answers[currentQuestion.id] || {}), drawingUrl: dataUrl }
        });
    };

    const toggleEssayInputMode = (questionId, mode) => {
        setEssayInputModes({ ...essayInputModes, [questionId]: mode });
    };

    const handleNext = () => { if (!isLastQuestion) setCurrentQuestionIndex(prev => prev + 1); };
    const handlePrev = () => { if (!isFirstQuestion) setCurrentQuestionIndex(prev => prev - 1); };

    const processSubmission = () => {
        if (timerRef.current) clearInterval(timerRef.current);

        let mcqCorrect = 0;
        let mcqTotal = 0;
        const subjectiveAnswers = [];
        const mcqDetails = [];

        // Evaluate against original questions
        examQuestions.forEach(q => {
            const userAnswer = answers[q.id];
            if (q.type === 'mcq') {
                mcqTotal++;
                const isCorrect = userAnswer === q.correctAnswer;
                if (isCorrect) mcqCorrect++;
                mcqDetails.push({
                    questionId: q.id,
                    questionText: q.text,
                    imageUrl: q.imageUrl || '',
                    userAnswerIndex: userAnswer,
                    correctAnswerIndex: q.correctAnswer,
                    options: q.options,
                    isCorrect,
                    explanation: q.explanation || '',
                    linkedMaterialId: q.linkedMaterialId || null
                });
            } else if (q.type === 'essay') {
                subjectiveAnswers.push({
                    questionId: q.id,
                    questionText: q.text,
                    imageUrl: q.imageUrl || '',
                    userAnswer: userAnswer?.text || '',
                    userDrawingUrl: userAnswer?.drawingUrl || '',
                    modelAnswer: q.modelAnswer,
                    explanation: q.explanation || '',
                    linkedMaterialId: q.linkedMaterialId || null
                });
            }
        });

        const percentage = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0;
        const result = {
            quizId: quiz.id,
            quizTitle: quiz.title,
            studentName: studentName || 'ไม่ระบุชื่อ',
            mcqScore: { correct: mcqCorrect, total: mcqTotal, percentage },
            mcqDetails,
            subjectiveAnswers
        };

        recordHistory({
            quizId: quiz.id,
            studentName: result.studentName,
            score: mcqCorrect,
            total: mcqTotal,
            percentage
        });

        navigateTo('result', { result });
    };

    const handleSubmit = () => {
        const unanswered = examQuestions
            .map((q, idx) => ({ q, num: idx + 1 }))
            .filter(({ q }) => {
                if (q.type === 'mcq') return answers[q.id] === undefined;
                return !answers[q.id]?.text?.trim() && !answers[q.id]?.drawingUrl;
            })
            .map(({ num }) => num);

        setUnansweredNums(unanswered);
        setShowSubmitModal(true);
    };

    const formatTime = (seconds) => {
        if (seconds === null) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const letters = ['ก', 'ข', 'ค', 'ง'];

    // Pre-exam screen
    if (!isExamStarted) {
        const limit = parseInt(quiz.numQuestionsToShow) || 0;
        const displayCount = limit > 0 && limit < quiz.questions.length ? limit : quiz.questions.length;
        return (
            <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{quiz.title}</h2>
                <div className="text-slate-500 mb-8 space-y-2">
                    <p>จำนวนข้อสอบ {displayCount} ข้อ{limit > 0 && limit < quiz.questions.length ? ` (สุ่มจาก ${quiz.questions.length} ข้อ)` : ''}</p>
                    {quiz.timeLimitMinutes > 0 && (
                        <p className="flex items-center justify-center gap-2 text-amber-600 font-medium">
                            <Clock className="w-4 h-4" /> จำกัดเวลา {quiz.timeLimitMinutes} นาที
                        </p>
                    )}
                </div>
                <div className="text-left space-y-4 mb-8">
                    <label className="block text-sm font-bold text-slate-700">ชื่อ-นามสกุล / รหัสประจำตัว (ถ้ามี)</label>
                    <Input
                        placeholder="พิมพ์ชื่อของคุณที่นี่..."
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => navigateTo('dashboard')}>ยกเลิก</Button>
                    <Button variant="primary" className="flex-1" onClick={() => setIsExamStarted(true)}>เริ่มทำข้อสอบ</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{quiz.title}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">ข้อที่ {currentQuestionIndex + 1} จากทั้งหมด {examQuestions.length}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {timeLeft !== null && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold border-2 ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                        </div>
                    )}
                    <div className="w-48">
                        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                            <span>ความคืบหน้า</span>
                            <span>{Math.round(((currentQuestionIndex + 1) / examQuestions.length) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Card */}
            <Card className="min-h-[400px] flex flex-col shadow-md border-slate-200">
                <CardContent className="flex-1 p-8 space-y-6">
                    {/* Question Text + Hint */}
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <div className="text-xl font-semibold text-slate-900 leading-relaxed">
                                <span className="text-primary-600 mr-2">{currentQuestionIndex + 1}.</span>
                                {currentQuestion.text}
                            </div>
                            {/* Question Image */}
                            {currentQuestion.imageUrl && (
                                <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                    <img
                                        src={currentQuestion.imageUrl}
                                        alt="รูปประกอบคำถาม"
                                        className="w-full max-h-72 object-contain"
                                    />
                                </div>
                            )}
                        </div>
                        {currentQuestion.linkedMaterialId && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full px-4"
                                onClick={() => {
                                    const material = quiz.materials.find(m => m.id === currentQuestion.linkedMaterialId);
                                    if (material) setHintMaterial(material);
                                }}
                            >
                                <Lightbulb className="w-4 h-4 mr-1.5" /> คำใบ้
                            </Button>
                        )}
                    </div>

                    {/* Answer Area */}
                    <div>
                        {currentQuestion.type === 'mcq' ? (
                            <div className="space-y-4">
                                {(currentQuestion.shuffledDisplayOptions || currentQuestion.options.map((opt, idx) => ({ text: opt, originalIndex: idx }))).map((optData, idx) => {
                                    const isSelected = answers[currentQuestion.id] === optData.originalIndex;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswerSelect(optData.originalIndex)}
                                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-start gap-4 ${isSelected
                                                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100 ring-offset-1 scale-[1.01]'
                                                : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors ${isSelected
                                                ? 'bg-primary-600 border-primary-600 text-white'
                                                : 'bg-slate-100 border-slate-300 text-slate-600'
                                                }`}>
                                                {isSelected ? <Check className="w-5 h-5" /> : letters[idx]}
                                            </div>
                                            <span className={`text-lg leading-snug mt-0.5 ${isSelected ? 'text-primary-900 font-semibold' : 'text-slate-700'}`}>
                                                {optData.text}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
                                    <button
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${essayInputModes[currentQuestion.id] !== 'draw' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        onClick={() => toggleEssayInputMode(currentQuestion.id, 'text')}
                                    >
                                        <Type className="w-4 h-4" /> พิมพ์คีย์บอร์ด
                                    </button>
                                    <button
                                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${essayInputModes[currentQuestion.id] === 'draw' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                        onClick={() => toggleEssayInputMode(currentQuestion.id, 'draw')}
                                    >
                                        <Pen className="w-4 h-4" /> วาด / เขียนด้วยปากกา
                                    </button>
                                </div>
                                {essayInputModes[currentQuestion.id] === 'draw' ? (
                                    <DrawingCanvas
                                        initialDataUrl={answers[currentQuestion.id]?.drawingUrl || ''}
                                        onSave={handleDrawingChange}
                                    />
                                ) : (
                                    <Textarea
                                        value={answers[currentQuestion.id]?.text || ''}
                                        onChange={handleTextAnswerChange}
                                        placeholder="พิมพ์คำตอบของคุณลงที่นี่..."
                                        className="min-h-[200px] text-lg p-5 leading-relaxed bg-slate-50 focus:bg-white transition-colors border-2"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
                    <Button variant="outline" onClick={handlePrev} disabled={isFirstQuestion} className="w-32 bg-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> ก่อนหน้า
                    </Button>
                    {isLastQuestion ? (
                        <Button onClick={handleSubmit} className="w-36 bg-emerald-600 hover:bg-emerald-700 shadow-md">
                            <Send className="w-4 h-4 mr-2" /> ส่งข้อสอบ
                        </Button>
                    ) : (
                        <Button onClick={handleNext} className="w-32 shadow-sm">
                            ถัดไป <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Question Navigation Grid */}
            <p className="text-center text-xs text-slate-400 pt-4">
                กด <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-500 font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-500 font-mono">→</kbd> เปลี่ยนข้อ &nbsp;|&nbsp; กด <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-500 font-mono">1</kbd>–<kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-500 font-mono">4</kbd> เลือกตอบปรนัย
            </p>
            <div className="flex justify-center flex-wrap gap-2.5 pt-3 pb-12">
                {examQuestions.map((q, idx) => {
                    const isAnswered = q.type === 'mcq'
                        ? answers[q.id] !== undefined
                        : (answers[q.id]?.text?.trim() || answers[q.id]?.drawingUrl);
                    return (
                        <button
                            key={q.id}
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={`w-10 h-10 md:w-11 md:h-11 rounded-full text-sm font-bold flex items-center justify-center transition-all border-2 ${currentQuestionIndex === idx
                                ? 'border-primary-600 bg-white text-primary-600 shadow-md scale-110'
                                : isAnswered
                                    ? 'bg-primary-100 border-primary-200 text-primary-800'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                        >
                            {idx + 1}
                        </button>
                    );
                })}
            </div>

            <MaterialViewerModal
                isOpen={!!hintMaterial}
                material={hintMaterial}
                onClose={() => setHintMaterial(null)}
            />

            {/* Submit Confirmation Modal */}
            {showSubmitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-100">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">ยืนยันการส่งข้อสอบ</h3>
                        {unansweredNums.length > 0 ? (
                            <div className="mb-6">
                                <p className="text-slate-600 mb-3">
                                    ยังมี <span className="font-bold text-red-600">{unansweredNums.length} ข้อ</span> ที่ยังไม่ได้ตอบ
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 mb-3">
                                    {unansweredNums.map(num => (
                                        <span key={num} className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                            ข้อ {num}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-slate-500">ต้องการส่งโดยปล่อยว่างข้อเหล่านี้หรือไม่?</p>
                            </div>
                        ) : (
                            <p className="text-slate-600 mb-6">ตอบครบทุกข้อแล้ว ต้องการส่งข้อสอบหรือไม่? เมื่อส่งแล้วจะแก้ไขไม่ได้</p>
                        )}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setShowSubmitModal(false)}>
                                กลับไปแก้ไข
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => { setShowSubmitModal(false); processSubmission(); }}
                            >
                                ยืนยันส่งข้อสอบ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeout Modal */}
            {showTimeoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-100">
                            <Clock className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">หมดเวลาแล้ว!</h3>
                        <p className="text-slate-600 mb-8">ระบบจะส่งคำตอบของคุณที่ตอบไว้โดยอัตโนมัติ</p>
                        <Button
                            className="w-full bg-red-600 hover:bg-red-700"
                            onClick={() => { setShowTimeoutModal(false); processSubmission(); }}
                        >
                            รับทราบ — ดูผลการสอบ
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
