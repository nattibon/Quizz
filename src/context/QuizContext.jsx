import React, { createContext, useContext, useState, useEffect } from 'react';

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
    // Load from LocalStorage or initialize with empty array
    const [quizzes, setQuizzes] = useState(() => {
        const saved = localStorage.getItem('quiz-sets');
        return saved ? JSON.parse(saved) : [];
    });

    const [history, setHistory] = useState(() => {
        const saved = localStorage.getItem('quiz-history');
        return saved ? JSON.parse(saved) : [];
    });

    // Save to LocalStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('quiz-sets', JSON.stringify(quizzes));
    }, [quizzes]);

    useEffect(() => {
        localStorage.setItem('quiz-history', JSON.stringify(history));
    }, [history]);

    const recordHistory = (result) => {
        const newRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...result
        };
        setHistory([newRecord, ...history]);
    };

    const exportState = () => {
        const data = { quizzes, history };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importState = (jsonData) => {
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed.quizzes) setQuizzes(parsed.quizzes);
            if (parsed.history) setHistory(parsed.history);
            return true;
        } catch (e) {
            console.error("Failed to parse import data", e);
            return false;
        }
    };

    const addQuiz = (quiz) => {
        const newQuiz = {
            ...quiz,
            id: Date.now().toString(),
            questions: [],
            materials: [],
        };
        setQuizzes([...quizzes, newQuiz]);
    };

    const updateQuiz = (id, updatedData) => {
        setQuizzes(quizzes.map(q => q.id === id ? { ...q, ...updatedData } : q));
    };

    const deleteQuiz = (id) => {
        setQuizzes(quizzes.filter(q => q.id !== id));
    };

    const addQuestion = (quizId, question) => {
        const newQuestion = {
            ...question,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
        };
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return { ...q, questions: [...q.questions, newQuestion] };
            }
            return q;
        }));
    };

    const updateQuestion = (quizId, questionId, updatedQuestion) => {
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return {
                    ...q,
                    questions: q.questions.map(question =>
                        question.id === questionId ? { ...question, ...updatedQuestion } : question
                    )
                };
            }
            return q;
        }));
    };

    const deleteQuestion = (quizId, questionId) => {
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return {
                    ...q,
                    questions: q.questions.filter(question => question.id !== questionId)
                };
            }
            return q;
        }));
    };

    const addMaterial = (quizId, material) => {
        const newMaterial = {
            ...material,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
        };
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return { ...q, materials: [...(q.materials || []), newMaterial] };
            }
            return q;
        }));
    };

    const updateMaterial = (quizId, materialId, updatedMaterial) => {
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return {
                    ...q,
                    materials: (q.materials || []).map(mat =>
                        mat.id === materialId ? { ...mat, ...updatedMaterial } : mat
                    )
                };
            }
            return q;
        }));
    };

    const deleteMaterial = (quizId, materialId) => {
        setQuizzes(quizzes.map(q => {
            if (q.id === quizId) {
                return {
                    ...q,
                    materials: (q.materials || []).filter(mat => mat.id !== materialId)
                };
            }
            return q;
        }));
    };

    return (
        <QuizContext.Provider value={{
            quizzes,
            history,
            addQuiz,
            updateQuiz,
            deleteQuiz,
            addQuestion,
            updateQuestion,
            deleteQuestion,
            addMaterial,
            updateMaterial,
            deleteMaterial,
            recordHistory,
            exportState,
            importState
        }}>
            {children}
        </QuizContext.Provider>
    );
}

export function useQuiz() {
    const context = useContext(QuizContext);
    if (!context) {
        throw new Error('useQuiz must be used within a QuizProvider');
    }
    return context;
}
