import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-80 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

const CONFIGS = {
    success: {
        wrapper: 'bg-emerald-50 border-emerald-300',
        text: 'text-emerald-800',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    },
    error: {
        wrapper: 'bg-red-50 border-red-300',
        text: 'text-red-800',
        icon: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    },
    info: {
        wrapper: 'bg-blue-50 border-blue-300',
        text: 'text-blue-800',
        icon: <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />,
    },
};

function ToastItem({ toast, onRemove }) {
    const cfg = CONFIGS[toast.type] || CONFIGS.info;
    return (
        <div className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${cfg.wrapper}`}>
            {cfg.icon}
            <p className={`text-sm font-medium flex-1 ${cfg.text}`}>{toast.message}</p>
            <button onClick={onRemove} className="text-slate-400 hover:text-slate-600 shrink-0 mt-0.5">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
