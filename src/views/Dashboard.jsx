import React, { useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Plus, Edit2, Trash2, Play, BookOpen, Settings, History, Printer } from 'lucide-react';
import ImportExportModal from '../components/ui/ImportExportModal';
import HistoryViewModal from '../components/ui/HistoryViewModal';

export default function Dashboard({ navigateTo }) {
    const { quizzes, addQuiz, deleteQuiz } = useQuiz();
    const [isCreating, setIsCreating] = useState(false);
    const [newQuizTitle, setNewQuizTitle] = useState('');
    const [newQuizDesc, setNewQuizDesc] = useState('');
    const [showImportExport, setShowImportExport] = useState(false);
    const [viewHistoryQuizId, setViewHistoryQuizId] = useState(null);

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newQuizTitle.trim()) return;
        addQuiz({ title: newQuizTitle, description: newQuizDesc });
        setNewQuizTitle('');
        setNewQuizDesc('');
        setIsCreating(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">แบบทดสอบของคุณ</h2>
                    <p className="text-slate-500 mt-1">จัดการและสร้างชุดแบบทดสอบใหม่สำหรับนักเรียน</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setShowImportExport(true)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
                        <Settings className="w-4 h-4 mr-2" />
                        สำรอง/นำเข้าข้อมูล
                    </Button>
                    {!isCreating && (
                        <Button onClick={() => setIsCreating(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            สร้างชุดแบบทดสอบ
                        </Button>
                    )}
                </div>
            </div>

            {isCreating && (
                <Card className="border-primary-200 shadow-md">
                    <form onSubmit={handleCreate}>
                        <CardHeader>
                            <CardTitle>สร้างแบบทดสอบใหม่</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                label="ชื่อวิชา / เรื่องที่ทดสอบ"
                                placeholder="เช่น คณิตศาสตร์ ม.1"
                                value={newQuizTitle}
                                onChange={(e) => setNewQuizTitle(e.target.value)}
                                autoFocus
                                required
                            />
                            <Textarea
                                label="คำอธิบาย (ไม่บังคับ)"
                                placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับแบบทดสอบชุดนี้..."
                                value={newQuizDesc}
                                onChange={(e) => setNewQuizDesc(e.target.value)}
                                rows={3}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-3 bg-slate-50">
                            <Button variant="ghost" type="button" onClick={() => setIsCreating(false)}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={!newQuizTitle.trim()}>
                                ยืนยันการสร้าง
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            )}

            {quizzes.length === 0 && !isCreating ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">ยังไม่มีแบบทดสอบ</h3>
                    <p className="text-slate-500 mb-6">เริ่มต้นการติวโดยกดสร้างชุดแบบทดสอบชุดแรกของคุณ</p>
                    <Button onClick={() => setIsCreating(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        สร้างชุดแบบทดสอบ
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz) => (
                        <Card key={quiz.id} className="flex flex-col hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 py-1">
                                <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                                    {quiz.description || "ไม่มีคำอธิบาย"}
                                </p>
                                <div className="flex items-center text-sm text-slate-500">
                                    <span className="bg-slate-100 px-2.5 py-1 rounded-full font-medium text-slate-700">
                                        {quiz.questions.length} ข้อ
                                    </span>
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-wrap gap-2 pt-4 bg-white border-t-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => navigateTo('editor', { quizId: quiz.id })}
                                >
                                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                    แก้ไข
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => navigateTo('study', { quizId: quiz.id })}
                                    title="อ่านเอกสารและดูสไลด์ก่อนทำข้อสอบ"
                                >
                                    <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                                    ติวเนื้อหา
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className="flex-1"
                                    disabled={quiz.questions.length === 0}
                                    onClick={() => navigateTo('exam', { quizId: quiz.id })}
                                >
                                    <Play className="w-3.5 h-3.5 mr-1.5" />
                                    ทำข้อสอบ
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => navigateTo('print', { quizId: quiz.id })}
                                    title="พิมพ์ข้อสอบ"
                                >
                                    <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแบบทดสอบชุดนี้?')) {
                                            deleteQuiz(quiz.id);
                                        }
                                    }}
                                    title="ลบแบบทดสอบ"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </CardFooter>

                            {/* History Footer */}
                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 w-full"
                                    onClick={() => setViewHistoryQuizId(quiz.id)}
                                >
                                    <History className="w-4 h-4 mr-2" /> ดูประวัติการสอบของนักเรียน
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <ImportExportModal isOpen={showImportExport} onClose={() => setShowImportExport(false)} />
            <HistoryViewModal quizId={viewHistoryQuizId} isOpen={!!viewHistoryQuizId} onClose={() => setViewHistoryQuizId(null)} />
        </div>
    );
}
