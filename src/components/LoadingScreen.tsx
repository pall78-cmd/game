import React from 'react';
import { motion } from 'framer-motion';

export const LoadingScreen = () => (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-gold z-50">
        <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full mb-6"
        />
        <h2 className="text-2xl font-header tracking-[8px] animate-pulse">CONNECTING</h2>
        <p className="text-sm text-white/50 mt-2 tracking-widest uppercase">Menyiapkan Meja Permainan</p>
    </div>
);
