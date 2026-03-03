import React, { useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Plus, Edit2, Trash2, Play, BookOpen, Settings, History, Printer, Search, Tag, X, Copy } from 'lucide-react';
import ImportExportModal from '../components/ui/ImportExportModal';
import HistoryViewModal from '../components/ui/HistoryViewModal';

export default function Dashboard({ navigateTo }) {
    const { quizzes, addQuiz, deleteQuiz, duplicateQuiz } = useQuiz();
    const [isCreating, setIsCreating] = useState(false);
    const [newQuizTitle, setNewQuizTitle] = useState('');
    const [newQuizDesc, setNewQuizDesc] = useState('');
    const [showImportExport, setShowImportExport] = useState(false);
    const [viewHistoryQuizId, setViewHistoryQuizId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);

    const handleCreate = (e) => {
        e.preventDefault();
        if (!newQuizTitle.trim()) return;
        addQuiz({ title: newQuizTitle, description: newQuizDesc });
        setNewQuizTitle('');
        setNewQuizDesc('');
        setIsCreating(false);
    };

    // Collect all unique tags from all quizzes
    const allTags = [...new Set(quizzes.flatMap(q => q.tags || []))].sort();

    // Filter quizzes by search query and selected tag
    const filteredQuizzes = quizzes.filter(quiz => {
        const matchesSearch = !searchQuery ||
            quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (quiz.description && quiz.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesTag = !selectedTag || (quiz.tags && quiz.tags.includes(selectedTag));
        return matchesSearch && matchesTag;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">แบบทดสอบของคุณ</h2>
                    <p className="text-slate-500 mt-1">จัดการและสร้างชุดแบบทดสอบใหม่สำหรับนักเรียน</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setShowImportExport(true)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
                        <Settings className="w-4 h-4 mr-2" />
                        สำรอง/นำเข้า
                    </Button>
                    {!isCreating && (
                        <Button onClick={() => setIsCreating(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            สร้างแบบทดสอบ
                        </Button>
                    )}
                </div>
            </div>

            {/* Create Form */}
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
                            <Button variant="ghost" type="button" onClick={() => setIsCreating(false)}>ยกเลิก</Button>
                            <Button type="submit" disabled={!newQuizTitle.trim()}>ยืนยันการสร้าง</Button>
                        </CardFooter>
                    </form>
                </Card>
            )}

            {/* Search + Tag Filter (only show when there are quizzes) */}
            {quizzes.length > 0 && (
                <div className="space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาแบบทดสอบ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Tag Filter Chips */}
                    {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <button
                                onClick={() => setSelectedTag(null)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!selectedTag ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                ทั้งหมด
                            </button>
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${selectedTag === tag ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quiz Grid */}
            {filteredQuizzes.length === 0 && !isCreating ? (
                quizzes.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">ยังไม่มีแบบทดสอบ</h3>
                        <p className="text-slate-500 mb-6">เริ่มต้นโดยกดสร้างชุดแบบทดสอบชุดแรกของคุณ</p>
                        <Button onClick={() => setIsCreating(true)}>
                            <Plus className="w-4 h-4 mr-2" /> สร้างชุดแบบทดสอบ
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">ไม่พบแบบทดสอบที่ตรงกับคำค้นหา</p>
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedTag(null); }}
                            className="mt-2 text-sm text-primary-600 hover:underline"
                        >
                            ล้างตัวกรอง
                        </button>
                    </div>
                )
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredQuizzes.map((quiz) => (
                        <Card key={quiz.id} className="flex flex-col hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 py-1">
                                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                                    {quiz.description || 'ไม่มีคำอธิบาย'}
                                </p>
                                <div className="flex items-center flex-wrap gap-2">
                                    <span className="bg-slate-100 px-2.5 py-1 rounded-full font-medium text-slate-700 text-sm">
                                        {quiz.questions.length} ข้อ
                                    </span>
                                    {/* Tags */}
                                    {(quiz.tags || []).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                            className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-semibold hover:bg-indigo-100 transition-colors"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-wrap gap-2 pt-4 bg-white border-t-0">
                                <Button
                                    variant="outline" size="sm" className="flex-1"
                                    onClick={() => navigateTo('editor', { quizId: quiz.id })}
                                >
                                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> แก้ไข
                                </Button>
                                <Button
                                    variant="outline" size="sm" className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => navigateTo('study', { quizId: quiz.id })}
                                >
                                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> ติวเนื้อหา
                                </Button>
                                <Button
                                    variant="primary" size="sm" className="flex-1"
                                    disabled={quiz.questions.length === 0}
                                    onClick={() => navigateTo('exam', { quizId: quiz.id })}
                                >
                                    <Play className="w-3.5 h-3.5 mr-1.5" /> ทำข้อสอบ
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => navigateTo('print', { quizId: quiz.id })}
                                    title="พิมพ์ข้อสอบ"
                                >
                                    <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className="text-slate-500 hover:text-violet-600 hover:bg-violet-50"
                                    onClick={() => duplicateQuiz(quiz.id)}
                                    title="คัดลอกแบบทดสอบ"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
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
                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex justify-center">
                                <Button
                                    variant="ghost" size="sm"
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
