import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

// ローディング画面コンポーネント
const LoadingScreen = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const totalDuration = 2000;
        const intervalTime = 20;
        const increment = 100 / (totalDuration / intervalTime);

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + increment + Math.random();
                if (next >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return next;
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (progress >= 100) {
            setTimeout(onComplete, 800);
        }
    }, [progress, onComplete]);

    return (
        <motion.div
            className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center"
            exit={{ y: '-100%', transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1] } }}
        >
            <div className="relative flex flex-col items-center">
                {/* フォントを font-display (Oswald) に指定 */}
                <h1 className="text-5xl md:text-9xl font-display font-bold tracking-widest mb-6 bg-gradient-to-r from-blue-600 via-teal-400 to-green-500 bg-clip-text text-transparent pb-2 animate-gradient-move">
                    MANSUKE
                </h1>

                <div className="w-[300px] h-1 bg-white/10 mt-8 relative overflow-hidden rounded-sm">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-[#ccff00] animate-gradient-move"
                        style={{ width: `${Math.min(100, progress)}%` }}
                    />
                </div>

                <p className="mt-4 text-xs font-mono text-gray-500 tracking-[0.2em]">
                    システム起動中 <span className="text-white font-bold">{Math.floor(progress)}%</span>
                </p>

                <p className="mt-8 text-sm md:text-base text-[#d5b263] font-display font-bold tracking-[0.2em] uppercase opacity-70">
                    Powered By Cerinal
                </p>
            </div>
        </motion.div>
    );
};

// メインレイアウト
const AppLayout = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    // /activate ページではヘッダーを非表示にする
    const shouldShowHeader = location.pathname !== '/activate';

    return (
        <>
            <div className="noise-overlay" />

            <AnimatePresence mode="wait">
                {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}
            </AnimatePresence>

            {!isLoading && (
                <>
                    {shouldShowHeader && (
                        <header className="fixed top-0 left-0 w-full p-4 md:p-10 z-[70] flex justify-between items-start pointer-events-none mix-blend-difference">
                            <div>
                                <Link to="/" className="block text-xl md:text-2xl font-bold font-display tracking-tighter pointer-events-auto hover-trigger text-white">
                                    MANSUKE
                                    <span className="text-[#d5b263] ml-2">PREPAID CARD</span>
                                </Link>
                            </div>
                        </header>
                    )}

                    <motion.main
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full h-screen relative pt-20 md:pt-24 px-4 md:px-12 pb-6 overflow-hidden flex flex-col"
                        // Activateページの場合はパディングを調整（全画面表示のため）
                        style={location.pathname === '/activate' ? { padding: 0 } : {}}
                    >
                        {children}
                    </motion.main>
                </>
            )}
        </>
    );
};

export default AppLayout;