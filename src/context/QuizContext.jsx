import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, set, update, remove, push } from 'firebase/database';

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
    const [quizzes, setQuizzes] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initialize listeners for real-time updates
    useEffect(() => {
        const quizzesRef = ref(database, 'quizzes');
        const historyRef = ref(database, 'history');

        const unsubscribeQuizzes = onValue(quizzesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Firebase stores lists as objects if they are pushed or mapped by ID
                // We'll convert the object back to an array
                const quizArray = Object.values(data).map(q => ({
                    ...q,
                    questions: q.questions ? Object.values(q.questions) : [],
                    materials: q.materials ? Object.values(q.materials) : []
                }));
                // Sort by creation time (descending) - assuming ID is timestamp based
                setQuizzes(quizArray.sort((a, b) => b.id - a.id));
            } else {
                setQuizzes([]);
            }
            setLoading(false);
        });

        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const historyArray = Object.values(data);
                // Sort by timestamp descending
                setHistory(historyArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
            } else {
                setHistory([]);
            }
        });

        return () => {
            unsubscribeQuizzes();
            unsubscribeHistory();
        };
    }, []);

    const recordHistory = async (result) => {
        const newRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...result
        };
        try {
            await set(ref(database, `history/${newRecord.id}`), newRecord);
        } catch (error) {
            console.error("Error saving history to Firebase", error);
        }
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

    // Keep importState for backward compatibility when transitioning from LocalStorage
    const importState = async (jsonData) => {
        try {
            const parsed = JSON.parse(jsonData);

            // Upload imported quizzes to Firebase
            if (parsed.quizzes && parsed.quizzes.length > 0) {
                const updates = {};
                parsed.quizzes.forEach(quiz => {
                    // Re-structure arrays to objects for Firebase
                    const quizToSave = { ...quiz };

                    if (quiz.questions && Array.isArray(quiz.questions)) {
                        const questionsObj = {};
                        quiz.questions.forEach(q => questionsObj[q.id] = q);
                        quizToSave.questions = questionsObj;
                    }

                    if (quiz.materials && Array.isArray(quiz.materials)) {
                        const materialsObj = {};
                        quiz.materials.forEach(m => materialsObj[m.id] = m);
                        quizToSave.materials = materialsObj;
                    }

                    updates[`quizzes/${quiz.id}`] = quizToSave;
                });
                await update(ref(database), updates);
            }

            // Upload imported history
            if (parsed.history && parsed.history.length > 0) {
                const historyUpdates = {};
                parsed.history.forEach(h => {
                    historyUpdates[`history/${h.id}`] = h;
                });
                await update(ref(database), historyUpdates);
            }

            return true;
        } catch (e) {
            console.error("Failed to parse or upload import data", e);
            return false;
        }
    };

    const addQuiz = async (quiz) => {
        const id = Date.now().toString();
        const newQuiz = {
            ...quiz,
            id,
            // Firebase prefers null or omitted over empty arrays for saving space
        };
        try {
            await set(ref(database, `quizzes/${id}`), newQuiz);
        } catch (error) {
            console.error("Error adding quiz to Firebase", error);
        }
    };

    const updateQuiz = async (id, updatedData) => {
        try {
            await update(ref(database, `quizzes/${id}`), updatedData);
        } catch (error) {
            console.error("Error updating quiz in Firebase", error);
        }
    };

    const deleteQuiz = async (id) => {
        try {
            await remove(ref(database, `quizzes/${id}`));
        } catch (error) {
            console.error("Error deleting quiz from Firebase", error);
        }
    };

    const addQuestion = async (quizId, question) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newQuestion = { ...question, id };
        try {
            await set(ref(database, `quizzes/${quizId}/questions/${id}`), newQuestion);
        } catch (error) {
            console.error("Error adding question", error);
        }
    };

    const updateQuestion = async (quizId, questionId, updatedQuestion) => {
        try {
            await update(ref(database, `quizzes/${quizId}/questions/${questionId}`), updatedQuestion);
        } catch (error) {
            console.error("Error updating question", error);
        }
    };

    const deleteQuestion = async (quizId, questionId) => {
        try {
            await remove(ref(database, `quizzes/${quizId}/questions/${questionId}`));
        } catch (error) {
            console.error("Error deleting question", error);
        }
    };

    const addMaterial = async (quizId, material) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newMaterial = { ...material, id };
        try {
            await set(ref(database, `quizzes/${quizId}/materials/${id}`), newMaterial);
        } catch (error) {
            console.error("Error adding material", error);
        }
    };

    const updateMaterial = async (quizId, materialId, updatedMaterial) => {
        try {
            await update(ref(database, `quizzes/${quizId}/materials/${materialId}`), updatedMaterial);
        } catch (error) {
            console.error("Error updating material", error);
        }
    };

    const deleteMaterial = async (quizId, materialId) => {
        try {
            await remove(ref(database, `quizzes/${quizId}/materials/${materialId}`));
        } catch (error) {
            console.error("Error deleting material", error);
        }
    };

    return (
        <QuizContext.Provider value={{
            quizzes,
            history,
            loading,
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
