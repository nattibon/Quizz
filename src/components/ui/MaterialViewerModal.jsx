import React from 'react';
import { Button } from './Button';
import { X } from 'lucide-react';

export default function MaterialViewerModal({ material, isOpen, onClose }) {
    if (!isOpen || !material) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs uppercase tracking-widest font-bold">
                            คำใบ้ / เนื้อหาอ้างอิง
                        </span>
                        {material.title || 'เนื้อหาประกอบ'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-red-500 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                        title="ปิด"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center items-start">
                    <div className="bg-white w-full rounded-xl shadow-sm border border-slate-200 p-8 min-h-full">
                        {material.type === 'text' && (
                            <div className="w-full flex flex-col gap-6">
                                {material.imageUrl && (
                                    <div className="flex justify-center w-full mb-4">
                                        <img
                                            src={material.imageUrl}
                                            alt={material.title || 'Attached Image'}
                                            className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                                        />
                                    </div>
                                )}
                                {material.content && (
                                    <div className="text-lg text-slate-800 whitespace-pre-wrap leading-relaxed">
                                        {material.content}
                                    </div>
                                )}
                            </div>
                        )}

                        {material.type === 'image' && (
                            <div className="flex justify-center w-full">
                                <img
                                    src={material.content}
                                    alt={material.title || 'Attached Image'}
                                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Image+Not+Found';
                                    }}
                                />
                            </div>
                        )}

                        {material.type === 'embed' && (
                            <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-inner max-w-4xl mx-auto">
                                <iframe
                                    src={material.content}
                                    className="w-full h-full border-0"
                                    allowFullScreen
                                    title={material.title || "Embed"}
                                ></iframe>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        ปิดหน้าต่าง
                    </Button>
                </div>
            </div>
        </div>
    );
}
