import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { X, Upload, Download, AlertCircle } from 'lucide-react';
import { useQuiz } from '../../context/QuizContext';

export default function ImportExportModal({ isOpen, onClose }) {
    const { exportState, importState } = useQuiz();
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const success = importState(content);
            if (success) {
                setImportError('');
                alert('นำเข้าข้อมูลสำเร็จ!');
                onClose();
            } else {
                setImportError('ไฟล์ไม่ถูกต้อง หรือ ข้อมูลเสียหาย');
            }
        };
        reader.readAsText(file);

        // reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800">สำรอง / นำเข้าข้อมูล (Backup & Restore)</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-red-500 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                        title="ปิด"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8">
                    {importError && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center gap-2 text-sm font-medium border border-red-200">
                            <AlertCircle className="w-4 h-4" /> {importError}
                        </div>
                    )}

                    {/* Export Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-indigo-700 font-bold mb-1">
                            <Download className="w-5 h-5" /> ส่งออกข้อมูล (Backup)
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            บันทึกแบบทดสอบทั้งหมด พร้อมประวัติการสอบของคุณออกมาเป็นไฟล์ <code>.json</code> เพื่อเก็บไว้สำรอง หรือนำไปเปิดในเครื่องอื่น
                        </p>
                        <Button variant="primary" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={exportState}>
                            <Download className="w-4 h-4 mr-2" /> ดาวน์โหลดไฟล์สำรองข้อมูล
                        </Button>
                    </div>

                    <div className="h-px bg-slate-200 w-full relative">
                        <div className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-slate-400 text-sm font-medium">หรือ</div>
                    </div>

                    {/* Import Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1">
                            <Upload className="w-5 h-5" /> นำเข้าข้อมูล (Restore)
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            อัปโหลดไฟล์ <code>.json</code> ที่ได้สำรองไว้กลับเข้ามาในระบบ (ข้อมูลที่นำเข้า จะไปรวมกับข้อมูลเดิมที่มีอยู่)
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={handleImportClick}>
                            <Upload className="w-4 h-4 mr-2" /> เลือกไฟล์เพื่อนำเข้า
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
}
