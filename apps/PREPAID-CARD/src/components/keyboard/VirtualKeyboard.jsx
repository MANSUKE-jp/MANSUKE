import React from 'react';
import { motion } from 'framer-motion';
import { Delete, CornerDownLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Key = ({ children, onClick, className, variant = 'default' }) => {
    const baseStyle = "h-16 w-full rounded-xl flex items-center justify-center text-xl font-bold transition-colors active:scale-95 select-none";
    const variants = {
        default: "bg-surface text-white hover:bg-white/10 border border-white/5",
        primary: "bg-primary text-black hover:bg-primary/90",
        secondary: "bg-white/5 text-white hover:bg-white/10"
    };

    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={twMerge(baseStyle, variants[variant], className)}
            data-hover // カーソル反応用
            type="button"
        >
            {children}
        </motion.button>
    );
};

const VirtualKeyboard = ({ onKeyPress, onDelete, onEnter, className }) => {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className={twMerge("w-full max-w-sm mx-auto p-4 bg-black/50 backdrop-blur-xl rounded-3xl border border-white/10", className)}>
            <div className="grid grid-cols-3 gap-3">
                {keys.map((num) => (
                    <Key key={num} onClick={() => onKeyPress(num.toString())}>
                        {num}
                    </Key>
                ))}

                {/* 0の左側（今回は空きスペース、必要なら'.'など） */}
                <Key variant="secondary" onClick={onDelete} className="text-error">
                    <Delete size={24} />
                </Key>

                <Key onClick={() => onKeyPress('0')}>0</Key>

                <Key variant="primary" onClick={onEnter}>
                    <CornerDownLeft size={24} />
                </Key>
            </div>
        </div>
    );
};

export default VirtualKeyboard;