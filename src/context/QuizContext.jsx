import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { useToast } from './ToastContext';

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
    const { addToast } = useToast();
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
                const quizArray = Object.values(data).map(q => ({
                    ...q,
                    questions: q.questions ? Object.values(q.questions) : [],
                    materials: q.materials ? Object.values(q.materials) : []
                }));
                setQuizzes(quizArray.sort((a, b) => b.id - a.id));
            } else {
                setQuizzes([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Firebase quizzes listener error", error);
            addToast('ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ', 'error', 6000);
            setLoading(false);
        });

        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const historyArray = Object.values(data);
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
            addToast('บันทึกประวัติการสอบไม่สำเร็จ', 'error');
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
        addToast('ส่งออกข้อมูลเรียบร้อยแล้ว', 'success');
    };

    const importState = async (jsonData) => {
        try {
            const parsed = JSON.parse(jsonData);

            if (parsed.quizzes && parsed.quizzes.length > 0) {
                const updates = {};
                parsed.quizzes.forEach(quiz => {
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

            if (parsed.history && parsed.history.length > 0) {
                const historyUpdates = {};
                parsed.history.forEach(h => {
                    historyUpdates[`history/${h.id}`] = h;
                });
                await update(ref(database), historyUpdates);
            }

            addToast('นำเข้าข้อมูลเรียบร้อยแล้ว', 'success');
            return true;
        } catch (e) {
            console.error("Failed to parse or upload import data", e);
            addToast('นำเข้าข้อมูลไม่สำเร็จ กรุณาตรวจสอบไฟล์', 'error');
            return false;
        }
    };

    const addQuiz = async (quiz) => {
        const id = Date.now().toString();
        const newQuiz = { ...quiz, id };
        try {
            await set(ref(database, `quizzes/${id}`), newQuiz);
            addToast('สร้างแบบทดสอบใหม่เรียบร้อยแล้ว', 'success');
        } catch (error) {
            console.error("Error adding quiz to Firebase", error);
            addToast('สร้างแบบทดสอบไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const updateQuiz = async (id, updatedData) => {
        try {
            await update(ref(database, `quizzes/${id}`), updatedData);
        } catch (error) {
            console.error("Error updating quiz in Firebase", error);
            addToast('บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const deleteQuiz = async (id) => {
        try {
            await remove(ref(database, `quizzes/${id}`));
            addToast('ลบแบบทดสอบเรียบร้อยแล้ว', 'success');
        } catch (error) {
            console.error("Error deleting quiz from Firebase", error);
            addToast('ลบแบบทดสอบไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const addQuestion = async (quizId, question) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newQuestion = { ...question, id };
        try {
            await set(ref(database, `quizzes/${quizId}/questions/${id}`), newQuestion);
        } catch (error) {
            console.error("Error adding question", error);
            addToast('เพิ่มคำถามไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const updateQuestion = async (quizId, questionId, updatedQuestion) => {
        try {
            await update(ref(database, `quizzes/${quizId}/questions/${questionId}`), updatedQuestion);
        } catch (error) {
            console.error("Error updating question", error);
            addToast('บันทึกคำถามไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const duplicateQuiz = async (originalId) => {
        const original = quizzes.find(q => q.id === originalId);
        if (!original) return;
        const newId = Date.now().toString();
        const quizToSave = { ...original, id: newId, title: `${original.title} (สำเนา)` };
        if (Array.isArray(original.questions)) {
            const obj = {};
            original.questions.forEach(q => obj[q.id] = q);
            quizToSave.questions = obj;
        }
        if (Array.isArray(original.materials)) {
            const obj = {};
            original.materials.forEach(m => obj[m.id] = m);
            quizToSave.materials = obj;
        }
        try {
            await set(ref(database, `quizzes/${newId}`), quizToSave);
            addToast('คัดลอกแบบทดสอบเรียบร้อยแล้ว', 'success');
        } catch (error) {
            console.error('Error duplicating quiz', error);
            addToast('คัดลอกแบบทดสอบไม่สำเร็จ', 'error');
        }
    };

    const deleteQuestion = async (quizId, questionId) => {
        try {
            await remove(ref(database, `quizzes/${quizId}/questions/${questionId}`));
            addToast('ลบคำถามเรียบร้อยแล้ว', 'success');
        } catch (error) {
            console.error("Error deleting question", error);
            addToast('ลบคำถามไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const addMaterial = async (quizId, material) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const newMaterial = { ...material, id };
        try {
            await set(ref(database, `quizzes/${quizId}/materials/${id}`), newMaterial);
        } catch (error) {
            console.error("Error adding material", error);
            addToast('เพิ่มสไลด์ไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const updateMaterial = async (quizId, materialId, updatedMaterial) => {
        try {
            await update(ref(database, `quizzes/${quizId}/materials/${materialId}`), updatedMaterial);
        } catch (error) {
            console.error("Error updating material", error);
            addToast('บันทึกสไลด์ไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    };

    const deleteMaterial = async (quizId, materialId) => {
        try {
            await remove(ref(database, `quizzes/${quizId}/materials/${materialId}`));
            addToast('ลบสไลด์เรียบร้อยแล้ว', 'success');
        } catch (error) {
            console.error("Error deleting material", error);
            addToast('ลบสไลด์ไม่สำเร็จ กรุณาลองใหม่', 'error');
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
            duplicateQuiz,
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
