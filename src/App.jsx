import React, { useState } from 'react';
import { QuizProvider, useQuiz } from './context/QuizContext';
import { BookOpen } from 'lucide-react';
import Dashboard from './views/Dashboard';
import QuizEditor from './views/QuizEditor';
import ExamMode from './views/ExamMode';
import ExamResult from './views/ExamResult';
import StudyMode from './views/StudyMode';
import PrintView from './views/PrintView';

function AppContent() {
  const { loading } = useQuiz();
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, editor, exam, result
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [examResult, setExamResult] = useState(null);

  const navigateTo = (view, params = {}) => {
    if (params.quizId) setActiveQuizId(params.quizId);
    if (params.result) setExamResult(params.result);
    setCurrentView(view);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar segment */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div
              className="flex items-center cursor-pointer"
              onClick={() => navigateTo('dashboard')}
            >
              <div className="bg-primary-600 text-white p-2 rounded-lg mr-3">
                <BookOpen size={20} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">ระบบสร้างและจัดการข้อสอบ</h1>
            </div>
            {currentView !== 'dashboard' && (
              <button
                onClick={() => navigateTo('dashboard')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                กลับหน้าแรก
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {loading ? (
        <main className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลจากเซิร์ฟเวอร์...</p>
        </main>
      ) : currentView === 'print' ? (
        <main className="w-full">
          <PrintView quizId={activeQuizId} navigateTo={navigateTo} />
        </main>
      ) : (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {currentView === 'dashboard' && <Dashboard navigateTo={navigateTo} />}
          {currentView === 'editor' && <QuizEditor quizId={activeQuizId} navigateTo={navigateTo} />}
          {currentView === 'study' && <StudyMode quizId={activeQuizId} navigateTo={navigateTo} />}
          {currentView === 'exam' && <ExamMode quizId={activeQuizId} navigateTo={navigateTo} />}
          {currentView === 'result' && <ExamResult result={examResult} navigateTo={navigateTo} />}
        </main>
      )}
    </div>
  );
}

function App() {
  return (
    <QuizProvider>
      <AppContent />
    </QuizProvider>
  );
}

export default App;
