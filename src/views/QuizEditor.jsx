import React, { useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { PlusCircle, Save, Trash2, HelpCircle, AlignLeft, CheckCircle2, LayoutList, FileText, Image as ImageIcon, Video, Link2, Upload } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

export default function QuizEditor({ quizId, navigateTo }) {
    const { quizzes, updateQuiz, addQuestion, updateQuestion, deleteQuestion, addMaterial, updateMaterial, deleteMaterial } = useQuiz();
    const quiz = quizzes.find(q => q.id === quizId);

    // Fallback if quiz is not found
    if (!quiz) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">ไม่พบแบบทดสอบนี้</p>
                <Button className="mt-4" onClick={() => navigateTo('dashboard')}>กลับหน้าแรก</Button>
            </div>
        );
    }

    const [title, setTitle] = useState(quiz.title);
    const [description, setDescription] = useState(quiz.description || '');
    const [shuffleQuestions, setShuffleQuestions] = useState(quiz.shuffleQuestions || false);
    const [shuffleOptions, setShuffleOptions] = useState(quiz.shuffleOptions || false);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(quiz.timeLimitMinutes || 0);
    const [activeTab, setActiveTab] = useState('questions'); // 'questions' or 'materials'

    const handleSaveQuizDetails = () => {
        updateQuiz(quiz.id, {
            title,
            description,
            shuffleQuestions,
            shuffleOptions
        });
    };

    const handleAddMCQ = () => {
        addQuestion(quiz.id, {
            type: 'mcq',
            text: '',
            imageUrl: '',
            options: ['', '', '', ''],
            correctAnswer: 0,
            explanation: ''
        });
    };

    const handleAddEssay = () => {
        addQuestion(quiz.id, {
            type: 'essay',
            text: '',
            imageUrl: '',
            modelAnswer: '',
            explanation: ''
        });
    };

    const handleAddMaterial = (type) => {
        addMaterial(quiz.id, {
            type, // 'text', 'image', 'embed'
            title: '',
            content: ''
        });
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">จัดการข้อสอบ</h2>
                    <p className="text-slate-500 mt-1">เพิ่ม แก้ไข และตั้งค่าข้อสอบในชุดนี้</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => navigateTo('exam', { quizId: quiz.id })} disabled={quiz.questions.length === 0}>
                        ทำข้อสอบ (Preview)
                    </Button>
                </div>
            </div>

            {/* Quiz Details Form */}
            <Card>
                <CardHeader>
                    <CardTitle>ข้อมูลและตั้งค่าแบบทดสอบ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input
                                label="ชื่อวิชา / เรื่องที่ทดสอบ"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={handleSaveQuizDetails}
                            />
                            <Textarea
                                label="คำอธิบายเพิ่มเติม"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={handleSaveQuizDetails}
                                rows={3}
                            />
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <h3 className="text-sm font-semibold text-indigo-900 mb-3">ตั้งเวลาทำข้อสอบ (นาที)</h3>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="เช่น 60"
                                    value={timeLimitMinutes || ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setTimeLimitMinutes(val);
                                        updateQuiz(quiz.id, { timeLimitMinutes: val });
                                    }}
                                    className="w-32 bg-white"
                                />
                                <span className="text-indigo-700 text-sm font-medium">
                                    {timeLimitMinutes > 0 ? `จำกัดเวลาทำข้อสอบ ${timeLimitMinutes} นาที` : 'ไม่จำกัดเวลา (ใส่ 0)'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-700">การตั้งค่าการสุ่มข้อสอบ (สำหรับโหมดทำข้อสอบ)</h3>
                            <label className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                    checked={shuffleQuestions}
                                    onChange={(e) => {
                                        setShuffleQuestions(e.target.checked);
                                        updateQuiz(quiz.id, { shuffleQuestions: e.target.checked });
                                    }}
                                />
                                <span className="text-slate-700 font-medium">สลับลำดับคำถาม (Randomize Questions)</span>
                            </label>

                            <label className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                    checked={shuffleOptions}
                                    onChange={(e) => {
                                        setShuffleOptions(e.target.checked);
                                        updateQuiz(quiz.id, { shuffleOptions: e.target.checked });
                                    }}
                                />
                                <span className="text-slate-700 font-medium">สลับลำดับตัวเลือก ก,ข,ค,ง (Randomize Choices)</span>
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'questions' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    onClick={() => setActiveTab('questions')}
                >
                    จัดการคำถาม ({quiz.questions.length})
                </button>
                <button
                    className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'materials' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    onClick={() => setActiveTab('materials')}
                >
                    จัดการเนื้อหาติว ({(quiz.materials || []).length})
                </button>
            </div>

            {/* Questions List */}
            {activeTab === 'questions' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">รายการคำถาม</h3>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAddMCQ} className="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500">
                                <HelpCircle className="w-4 h-4 mr-2" />
                                เพิ่มข้อสอบปรนัย (MCQ)
                            </Button>
                            <Button size="sm" onClick={handleAddEssay} className="bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500">
                                <AlignLeft className="w-4 h-4 mr-2" />
                                เพิ่มข้อสอบอัตนัย (Essay)
                            </Button>
                        </div>
                    </div>

                    {quiz.questions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
                            <p className="text-slate-500 mb-4">ยังไม่ได้สร้างคำถามเลย เริ่มต้นโดยกดปุ่มเพิ่มข้อสอบปรนัยหรือข้อสอบอัตนัย</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {quiz.questions.map((q, index) => (
                                <QuestionEditorCard
                                    key={q.id}
                                    index={index}
                                    question={q}
                                    quizId={quiz.id}
                                    quizMaterials={quiz.materials || []}
                                    updateQuestion={updateQuestion}
                                    deleteQuestion={deleteQuestion}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Materials Editor */}
            {activeTab === 'materials' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                            <LayoutList className="w-5 h-5" /> เนื้อหาสำหรับการติว (สไลด์ที่จะแสดงก่อนทำข้อสอบ)
                        </h3>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleAddMaterial('slide')} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                                <LayoutList className="w-4 h-4 mr-2" />
                                เพิ่มสไลด์ (ข้อความ + รูปภาพ + วิดีโอ/สไลด์ Embed)
                            </Button>
                        </div>
                    </div>

                    {(quiz.materials || []).length === 0 ? (
                        <div className="bg-amber-50 rounded-xl border border-dashed border-amber-300 p-8 text-center">
                            <p className="text-amber-800 mb-2 font-medium">เพิ่มเนื้อหาการติวก่อนส่งข้อสอบ 💡</p>
                            <p className="text-amber-600/80 text-sm">ให้นักเรียนได้ศึกษาทบทวนเนื้อหาเป็นสไลด์ก่อนทำการทดสอบ</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {(quiz.materials || []).map((mat, index) => (
                                <MaterialEditorCard
                                    key={mat.id}
                                    index={index}
                                    material={mat}
                                    quizId={quiz.id}
                                    updateMaterial={updateMaterial}
                                    deleteMaterial={deleteMaterial}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MaterialEditorCard({ index, material, quizId, updateMaterial, deleteMaterial }) {
    const handleChange = (field, value) => {
        updateMaterial(quizId, material.id, { [field]: value });
    };

    const icon = <LayoutList className="w-5 h-5 text-amber-600" />;
    const typeLabel = "เนื้อหาสไลด์";

    return (
        <Card className="border-amber-200 shadow-sm">
            <div className="bg-amber-50 border-b border-amber-100 p-4 flex justify-between items-center rounded-t-xl">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                    {icon} สไลด์หน้า {index + 1}: {typeLabel}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-amber-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                    onClick={() => {
                        if (window.confirm('ยืนยันการลบสไลด์หน้านี้?')) {
                            deleteMaterial(quizId, material.id);
                        }
                    }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
            <CardContent className="p-6 space-y-4">
                <Input
                    label="หัวข้อสไลด์ (ไม่บังคับ)"
                    placeholder="ใส่หัวข้อเรื่องสไลด์หน้านี้..."
                    value={material.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                />

                <div className="space-y-6">
                    <Textarea
                        label="รายละเอียดเนื้อหา"
                        placeholder="พิมพ์เนื้อหาที่ต้องการให้นักเรียนอ่านที่นี่..."
                        value={material.content || ''}
                        onChange={(e) => handleChange('content', e.target.value)}
                        rows={4}
                    />

                    {/* Image upload section for all slides */}
                    <div className="pt-4 border-t border-amber-100">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">รูปภาพประกอบสไลด์ (ไม่บังคับ)</label>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center justify-center px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                <Upload className="w-4 h-4 mr-2 text-slate-500" /> แนบรูปภาพ
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    className="sr-only"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            try {
                                                const base64ImageUrl = await compressImage(file);
                                                handleChange('imageUrl', base64ImageUrl);
                                            } catch (error) {
                                                alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
                                            }
                                        }
                                    }}
                                />
                            </label>
                            {material.imageUrl && (
                                <Button variant="ghost" size="sm" onClick={() => handleChange('imageUrl', '')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    ลบรูป
                                </Button>
                            )}
                        </div>
                        {material.imageUrl && (
                            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-lg">
                                <img src={material.imageUrl} alt="Preview" className="w-full h-auto rounded object-contain max-h-64" />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-amber-100 space-y-4">
                        <Input
                            label="Embed URL (เช่น ลิงก์จาก YouTube หรือ Google Slides)"
                            placeholder="ตัวอย่าง: https://www.youtube.com/embed/dQw4w9WgXcQ"
                            value={material.embedUrl || ''}
                            onChange={(e) => handleChange('embedUrl', e.target.value)}
                        />
                        {material.embedUrl && (
                            <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden max-w-2xl mt-4">
                                <iframe
                                    src={material.embedUrl}
                                    className="w-full h-full border-0"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 font-medium">* ต้องเป็น URL แบบ Embed ที่อนุญาตให้ใส่ใน iframe ได้เท่านั้น (เช่น YouTube Embed หรือ Google Slides Publish to Web)</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function QuestionEditorCard({ index, question, quizId, quizMaterials, updateQuestion, deleteQuestion }) {
    const isMCQ = question.type === 'mcq';

    const handleChange = (field, value) => {
        updateQuestion(quizId, question.id, { [field]: value });
    };

    const handleOptionChange = (optIndex, value) => {
        const newOptions = [...question.options];
        newOptions[optIndex] = value;
        handleChange('options', newOptions);
    };

    const letters = ['ก', 'ข', 'ค', 'ง'];

    return (
        <Card className="border-slate-200 overflow-visible relative shadow-sm hover:shadow transition-shadow">
            <div className="absolute -left-4 -top-4 w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-base shadow-sm ring-4 ring-slate-50">
                ข้อ {index + 1}
            </div>

            <div className="p-6 pt-10 space-y-6">
                <div className="flex justify-between items-start gap-4">
                    <div className="w-full space-y-3">
                        <Input
                            label={isMCQ ? "คำถาม (ปรนัย - เลือกตอบ)" : "คำถาม (อัตนัย - พิมพ์ตอบ)"}
                            placeholder="พิมพ์คำถามของคุณที่นี่..."
                            value={question.text}
                            onChange={(e) => handleChange('text', e.target.value)}
                            className="text-base font-medium py-2.5"
                        />
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">รูปภาพประกอบคำถาม (ตัวเลือกเสริม)</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center justify-center px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                    <Upload className="w-4 h-4 mr-2 text-slate-500" /> แนบรูปภาพคำถาม
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        className="sr-only"
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                try {
                                                    const base64ImageUrl = await compressImage(file);
                                                    handleChange('imageUrl', base64ImageUrl);
                                                } catch (error) {
                                                    alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
                                                }
                                            }
                                        }}
                                    />
                                </label>
                                {question.imageUrl && (
                                    <Button variant="ghost" size="sm" onClick={() => handleChange('imageUrl', '')} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        ลบรูป
                                    </Button>
                                )}
                            </div>
                        </div>
                        {question.imageUrl && (
                            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-sm">
                                <img
                                    src={question.imageUrl}
                                    alt="Question Attachment"
                                    className="w-full h-auto rounded object-contain max-h-48"
                                />
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-600 shrink-0 mt-6"
                        onClick={() => {
                            if (window.confirm('ยืนยันการลบข้อสอบข้อนี้?')) {
                                deleteQuestion(quizId, question.id);
                            }
                        }}
                    >
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>

                {isMCQ ? (
                    <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-100">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">ตัวเลือก (คลิกที่วงกลมเพื่อเลือกข้อที่ถูกต้อง)</label>
                        {question.options.map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleChange('correctAnswer', optIndex)}
                                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm border ${question.correctAnswer === optIndex
                                        ? 'bg-emerald-500 border-emerald-600 text-white transform scale-105'
                                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    title={question.correctAnswer === optIndex ? "คำตอบที่ถูกต้อง" : "เลือกให้เป็นคำตอบที่ถูกต้อง"}
                                >
                                    {question.correctAnswer === optIndex ? <CheckCircle2 className="w-6 h-6" /> : letters[optIndex]}
                                </button>
                                <Input
                                    value={opt}
                                    onChange={(e) => handleOptionChange(optIndex, e.target.value)}
                                    placeholder={`ตัวเลือก ${letters[optIndex]}`}
                                    className={question.correctAnswer === optIndex ? 'border-emerald-300 ring-2 ring-emerald-100 ring-offset-1 font-medium' : ''}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-indigo-50/50 p-5 rounded-lg border border-indigo-100">
                        <Textarea
                            label="แนวการตอบมาตรฐาน (Model Answer)"
                            placeholder="ระบุแนวทางการตอบ หรือ คีย์เวิร์ดสำคัญ สำหรับให้นักเรียนดูเปรียบเทียบตอนประเมินผล..."
                            value={question.modelAnswer}
                            onChange={(e) => handleChange('modelAnswer', e.target.value)}
                            rows={4}
                        />
                    </div>
                )}

                <div className="bg-amber-50/50 p-5 rounded-lg border border-amber-100 space-y-4">
                    <Textarea
                        label="คำอธิบายเฉลย (Detailed Explanation) ⭐️ แนะนำสำหรับการติว"
                        placeholder="อธิบายเหตุผลของคำตอบ หรือ ชี้จุดผิดที่พบบ่อย เพื่อให้นักเรียนเข้าใจเนื้อหามากขึ้นหลังทำข้อสอบเสร็จ..."
                        value={question.explanation || ''}
                        onChange={(e) => handleChange('explanation', e.target.value)}
                        rows={3}
                        className="border-amber-200 focus:border-amber-400 focus:ring-amber-400"
                    />

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                            <Link2 className="w-4 h-4 text-slate-500" /> เชื่อมโยงสไลด์เนื้อหาติว (ให้เปิดดูก่อน/หลังตอบข้อนี้)
                        </label>
                        <select
                            className="w-full rounded-md border-slate-300 py-2.5 px-3 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm bg-white"
                            value={question.linkedMaterialId || ''}
                            onChange={(e) => handleChange('linkedMaterialId', e.target.value)}
                        >
                            <option value="">-- ไม่เชื่อมโยงสไลด์ --</option>
                            {quizMaterials.map((mat, i) => (
                                <option key={mat.id} value={mat.id}>
                                    สไลด์หน้าที่ {i + 1}: {mat.title || '(ไม่มีชื่อหัวข้อ)'} [{mat.type}]
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500">นักเรียนสามารถกดดูสไลด์หน้านี้เป็น "คำใบ้" ตอนทำข้อสอบ หรือดูตอนเฉลยได้</p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
