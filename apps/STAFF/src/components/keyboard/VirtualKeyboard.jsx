import React from 'react';
import { motion } from 'framer-motion';
import { Delete, CornerDownLeft } from 'lucide-react';

const keyStyle = {
    height: 64, width: '100%', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer',
    userSelect: 'none', transition: 'background 0.15s',
    fontFamily: "'Oswald', sans-serif",
};

const Key = ({ children, onClick, style }) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{ ...keyStyle, ...style }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = style?.background || 'rgba(255,255,255,0.05)'; }}
        type="button"
    >
        {children}
    </motion.button>
);

const VirtualKeyboard = ({ onKeyPress, onDelete, onEnter }) => {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return (
        <div style={{
            width: '100%', maxWidth: 360, margin: '0 auto', padding: 16,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
            borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {keys.map(num => (
                    <Key key={num} onClick={() => onKeyPress(num.toString())}>{num}</Key>
                ))}
                <Key onClick={onDelete} style={{ color: '#ef4444' }}>
                    <Delete size={24} />
                </Key>
                <Key onClick={() => onKeyPress('0')}>0</Key>
                <Key onClick={onEnter} style={{ background: '#d4af37', color: '#000' }}>
                    <CornerDownLeft size={24} />
                </Key>
            </div>
        </div>
    );
};

export default VirtualKeyboard;
