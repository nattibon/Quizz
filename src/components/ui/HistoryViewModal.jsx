import React from 'react';
import { Button } from './Button';
import { X, Trophy, Clock, CheckCircle2, History, Download, TrendingUp, Users, Award } from 'lucide-react';
import { useQuiz } from '../../context/QuizContext';

export default function HistoryViewModal({ quizId, isOpen, onClose }) {
    const { history, quizzes } = useQuiz();
    const quiz = quizzes.find(q => q.id === quizId);

    const quizHistory = history.filter(h => h.quizId === quizId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!isOpen || !quiz) return null;

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    // Statistics
    const totalAttempts = quizHistory.length;
    const avgPct = totalAttempts > 0
        ? Math.round(quizHistory.reduce((s, r) => s + r.percentage, 0) / totalAttempts)
        : 0;
    const passCount = quizHistory.filter(r => r.percentage >= 80).length;
    const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;
    const bestPct = totalAttempts > 0 ? Math.max(...quizHistory.map(r => r.percentage)) : 0;

    const handleExportCSV = () => {
        const BOM = '\uFEFF';
        const headers = ['ชื่อ-สกุล', 'วันที่-เวลา', 'คะแนน', 'เต็ม', 'เปอร์เซ็นต์'];
        const rows = quizHistory.map(r => [
            `"${r.studentName || 'ไม่ระบุชื่อ'}"`,
            `"${formatDate(r.timestamp)}"`,
            r.score,
            r.total,
            `${r.percentage}%`
        ]);
        const csvContent = BOM + [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz.title}-history.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            ประวัติการสอบ
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">{quiz.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {totalAttempts > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={handleExportCSV}
                            >
                                <Download className="w-4 h-4 mr-1.5" /> Export CSV
                            </Button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-red-500 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                            title="ปิด"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                {totalAttempts > 0 && (
                    <div className="grid grid-cols-4 gap-0 border-b border-slate-100 divide-x divide-slate-100">
                        <div className="flex flex-col items-center justify-center p-4 bg-white">
                            <Users className="w-5 h-5 text-indigo-400 mb-1" />
                            <div className="text-2xl font-black text-indigo-600">{totalAttempts}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">ครั้งทั้งหมด</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-white">
                            <TrendingUp className="w-5 h-5 text-blue-400 mb-1" />
                            <div className="text-2xl font-black text-blue-600">{avgPct}%</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">คะแนนเฉลี่ย</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-white">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                            <div className="text-2xl font-black text-emerald-600">{passRate}%</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">ผ่านเกณฑ์ (≥80%)</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-white">
                            <Award className="w-5 h-5 text-amber-400 mb-1" />
                            <div className="text-2xl font-black text-amber-600">{bestPct}%</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">คะแนนสูงสุด</div>
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    {quizHistory.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <History className="w-8 h-8 text-slate-400" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-1">ยังไม่มีประวัติการทำแบบทดสอบชุดนี้</h4>
                            <p className="text-slate-500">เมื่อมีนักเรียนทำการทดสอบเสร็จสิ้น คะแนนจะแสดงที่นี่</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {quizHistory.map((record) => {
                                let scoreColor = 'text-primary-600';
                                let scoreBg = 'bg-primary-50 border-primary-100';
                                if (record.percentage >= 80) {
                                    scoreColor = 'text-emerald-600';
                                    scoreBg = 'bg-emerald-50 border-emerald-100';
                                } else if (record.percentage < 50) {
                                    scoreColor = 'text-red-600';
                                    scoreBg = 'bg-red-50 border-red-100';
                                }

                                return (
                                    <div key={record.id} className="bg-white border text-center md:text-left border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 hover:border-indigo-300 transition-colors">

                                        {/* Student Info */}
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
                                                {record.studentName ? record.studentName.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-slate-900">{record.studentName || 'ไม่ระบุชื่อ'}</h4>
                                                <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mt-1">
                                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(record.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score Snapshot */}
                                        <div className={`shrink-0 flex items-center justify-center gap-4 px-6 py-3 rounded-xl border ${scoreBg}`}>
                                            <div className="text-center">
                                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">คะแนนปรนัย</div>
                                                <div className={`text-2xl font-black ${scoreColor}`}>
                                                    <span className="flex items-center gap-1.5 justify-center">
                                                        <CheckCircle2 className="w-5 h-5 opacity-70" />
                                                        {record.score} <span className="text-base text-slate-400 font-medium">/ {record.total}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-px h-10 bg-slate-300 mx-1"></div>
                                            <div className="text-center">
                                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">เปอร์เซ็นต์</div>
                                                <div className={`text-2xl font-black ${scoreColor}`}>
                                                    {record.percentage}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
