import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const LoadingScreen = ({ error, onCancel }: { error?: string, onCancel?: () => void }) => {
    const [isTimeout, setIsTimeout] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsTimeout(true);
        }, 10000); // 10 seconds timeout
        return () => clearTimeout(timer);
    }, []);

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            window.dispatchEvent(new CustomEvent('cancelGameConnection'));
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-gold z-50">
            <button 
                onClick={handleCancel}
                className="absolute top-4 right-4 text-white/50 hover:text-white z-50"
            >
                Batal
            </button>
            <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full mb-6"
            />
            <h2 className="text-2xl font-header tracking-[8px] animate-pulse">
                {error || isTimeout ? 'ERROR' : 'CONNECTING'}
            </h2>
            <p className="text-sm text-white/50 mt-2 tracking-widest uppercase text-center max-w-xs">
                {error ? error : isTimeout ? 'Koneksi ke server gagal. Silakan coba lagi.' : 'Menyiapkan Meja Permainan'}
            </p>
            {(error || isTimeout) && (
                <div className="flex gap-4 mt-6">
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-gold/20 border border-gold/50 rounded-lg text-gold hover:bg-gold/30 transition-colors"
                    >
                        RETRY
                    </button>
                    <button 
                        onClick={handleCancel}
                        className="px-6 py-2 bg-red-900/20 border border-red-500/50 rounded-lg text-red-500 hover:bg-red-900/30 transition-colors"
                    >
                        KEMBALI
                    </button>
                </div>
            )}
        </div>
    );
};
