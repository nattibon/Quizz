import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Textarea, Input } from '../components/ui/Input';
import { ArrowLeft, ArrowRight, Check, Send, Type, Pen, Lightbulb, Clock, User } from 'lucide-react';
import DrawingCanvas from '../components/ui/DrawingCanvas';
import MaterialViewerModal from '../components/ui/MaterialViewerModal';

// Fisher-Yates shuffle algorithm
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
    const [timeLeft, setTimeLeft] = useState(null); // in seconds
    const timerRef = useRef(null);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({}); // { questionId: selectedIndex (mcq) | { text, drawingUrl } (essay) }
    const [examQuestions, setExamQuestions] = useState([]);
    const [essayInputModes, setEssayInputModes] = useState({}); // { questionId: 'text' | 'draw' }
    const [hintMaterial, setHintMaterial] = useState(null);

    // Initialize the exam based on shuffle settings
    useEffect(() => {
        if (quiz && quiz.questions.length > 0) {
            let preparedQuestions = [...quiz.questions];

            // Shuffle Questions if enabled
            if (quiz.shuffleQuestions) {
                preparedQuestions = shuffleArray(preparedQuestions);
            }

            // Shuffle Options for MCQ if enabled
            preparedQuestions = preparedQuestions.map(q => {
                if (q.type === 'mcq' && quiz.shuffleOptions) {
                    // Keep track of the original index to grade it correctly
                    const optionsWithOriginalIndex = q.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
                    const shuffledOptions = shuffleArray(optionsWithOriginalIndex);
                    return { ...q, shuffledDisplayOptions: shuffledOptions };
                }
                return q;
            });

            setExamQuestions(preparedQuestions);
        }
    }, [quiz]);

    // Timer Logic
    useEffect(() => {
        if (isExamStarted && quiz?.timeLimitMinutes > 0) {
            setTimeLeft(quiz.timeLimitMinutes * 60);

            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        handleAutoSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isExamStarted, quiz]);

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
                <Button className="mt-4" onClick={() => navigateTo('editor', { quizId })}>ไปหน้าแก้ไข (Editor)</Button>
            </div>
        );
    }

    const currentQuestion = examQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;
    const isFirstQuestion = currentQuestionIndex === 0;

    const handleAnswerSelect = (originalIndex) => {
        setAnswers({
            ...answers,
            [currentQuestion.id]: originalIndex
        });
    };

    const handleTextAnswerChange = (e) => {
        setAnswers({
            ...answers,
            [currentQuestion.id]: {
                ...(answers[currentQuestion.id] || {}),
                text: e.target.value
            }
        });
    };

    const handleDrawingChange = (dataUrl) => {
        setAnswers({
            ...answers,
            [currentQuestion.id]: {
                ...(answers[currentQuestion.id] || {}),
                drawingUrl: dataUrl
            }
        });
    };

    const toggleEssayInputMode = (questionId, mode) => {
        setEssayInputModes({
            ...essayInputModes,
            [questionId]: mode
        });
    };

    const handleNext = () => {
        if (!isLastQuestion) setCurrentQuestionIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        if (!isFirstQuestion) setCurrentQuestionIndex(prev => prev - 1);
    };

    const processSubmission = () => {
        if (timerRef.current) clearInterval(timerRef.current);

        // Calculate score
        let mcqCorrect = 0;
        let mcqTotal = 0;

        const subjectiveAnswers = [];
        const mcqDetails = []; // Keep track of mcq answers for detailed feedback

        // We evaluate based on the original un-shuffled quiz.questions to ensure correctness
        quiz.questions.forEach(q => {
            const userAnswer = answers[q.id];
            if (q.type === 'mcq') {
                mcqTotal++;
                const isCorrect = userAnswer === q.correctAnswer;
                if (isCorrect) mcqCorrect++;

                mcqDetails.push({
                    questionId: q.id,
                    questionText: q.text,
                    userAnswerIndex: userAnswer,
                    correctAnswerIndex: q.correctAnswer,
                    options: q.options,
                    isCorrect: isCorrect,
                    explanation: q.explanation || '',
                    linkedMaterialId: q.linkedMaterialId || null
                });
            } else if (q.type === 'essay') {
                subjectiveAnswers.push({
                    questionId: q.id,
                    questionText: q.text,
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
            mcqScore: {
                correct: mcqCorrect,
                total: mcqTotal,
                percentage: percentage
            },
            mcqDetails,
            subjectiveAnswers
        };

        // Record history
        recordHistory({
            quizId: quiz.id,
            studentName: result.studentName,
            score: mcqCorrect,
            total: mcqTotal,
            percentage: percentage
        });

        navigateTo('result', { result });
    };

    const handleAutoSubmit = () => {
        alert('หมดเวลาทำข้อสอบ! ระบบจะส่งคำตอบของคุณอัตโนมัติ');
        processSubmission();
    };

    const handleSubmit = () => {
        if (window.confirm('คุณต้องการส่งข้อสอบใช่หรือไม่? เมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีก')) {
            processSubmission();
        }
    };

    const letters = ['ก', 'ข', 'ค', 'ง'];

    const formatTime = (seconds) => {
        if (seconds === null) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Pre-exam screen
    if (!isExamStarted) {
        return (
            <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{quiz.title}</h2>
                <div className="text-slate-500 mb-8 space-y-2">
                    <p>จำนวนคำถามทั้งหมด {quiz.questions.length} ข้อ</p>
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
                    <Button variant="outline" className="flex-1" onClick={() => navigateTo('dashboard')}>
                        ยกเลิก
                    </Button>
                    <Button variant="primary" className="flex-1" onClick={() => setIsExamStarted(true)}>
                        เริ่มทำข้อสอบ
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{quiz.title}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">ข้อที่ {currentQuestionIndex + 1} จากทั้งหมด {examQuestions.length}</p>
                </div>

                <div className="flex flex-col items-end gap-3">
                    {/* Timer */}
                    {timeLeft !== null && (
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold border-2 ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="w-48">
                        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                            <span>ความคืบหน้า</span>
                            <span>{Math.round(((currentQuestionIndex + 1) / examQuestions.length) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300 shadow-sm"
                                style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="min-h-[400px] flex flex-col shadow-md border-slate-200">
                <CardContent className="flex-1 p-8 space-y-8">
                    <div className="flex justify-between items-start gap-4">
                        <div className="text-xl font-semibold text-slate-900 leading-relaxed">
                            <span className="text-primary-600 mr-2">{currentQuestionIndex + 1}.</span> {currentQuestion.text}
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
                                <Lightbulb className="w-4 h-4 mr-1.5" /> คำใบ้ / ดูเนื้อหา
                            </Button>
                        )}
                    </div>

                    <div className="mt-8">
                        {currentQuestion.type === 'mcq' ? (
                            <div className="space-y-4">
                                {(currentQuestion.shuffledDisplayOptions || currentQuestion.options.map((opt, idx) => ({ text: opt, originalIndex: idx }))).map((optData, idx) => {
                                    const isSelected = answers[currentQuestion.id] === optData.originalIndex;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswerSelect(optData.originalIndex)}
                                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all flex items-start gap-4 ${isSelected
                                                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100 ring-offset-1 transform scale-[1.01]'
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
                                <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4 border border-slate-200">
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
                    <Button
                        variant="outline"
                        onClick={handlePrev}
                        disabled={isFirstQuestion}
                        className="w-32 bg-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> ข้อก่อนหน้า
                    </Button>

                    {isLastQuestion ? (
                        <Button onClick={handleSubmit} className="w-36 bg-emerald-600 hover:bg-emerald-700 shadow-md">
                            <Send className="w-4 h-4 mr-2" /> ส่งข้อสอบ
                        </Button>
                    ) : (
                        <Button onClick={handleNext} className="w-32 shadow-sm">
                            ข้อถัดไป <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Navigation Grid */}
            <div className="flex justify-center flex-wrap gap-2.5 pt-6 pb-12">
                {examQuestions.map((q, idx) => {
                    let isAnswered = false;
                    if (q.type === 'mcq') {
                        isAnswered = answers[q.id] !== undefined;
                    } else {
                        isAnswered = (answers[q.id]?.text && answers[q.id].text.trim() !== '') || (answers[q.id]?.drawingUrl && answers[q.id].drawingUrl !== '');
                    }

                    return (
                        <button
                            key={q.id}
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={`w-10 h-10 md:w-11 md:h-11 rounded-full text-sm font-bold flex items-center justify-center transition-all border-2 ${currentQuestionIndex === idx
                                ? 'border-primary-600 bg-white text-primary-600 shadow-md transform scale-110'
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
        </div>
    );
}
