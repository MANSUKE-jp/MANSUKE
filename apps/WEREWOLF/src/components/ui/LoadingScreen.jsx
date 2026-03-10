import React from 'react';

/**
 * Shared loading screen component with shimmering logo and pulse animation.
 * @param {Object} props
 * @param {string} props.message - The granular status message to display.
 * @param {boolean} props.fullScreen - Whether it should cover the whole screen.
 */
const LoadingScreen = ({ message = "System Initializing...", fullScreen = true }) => {
    return (
        <div className={`${fullScreen ? 'min-h-screen' : 'h-full w-full min-h-[300px]'} bg-gray-950 flex flex-col items-center justify-center text-gray-100 overflow-hidden relative rounded-xl`}>
            {/* 背景装飾 */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-950/30 rounded-full blur-[120px] animate-pulse-slow"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center animate-fade-in">
                {/* タイトルロゴ (アニメーション版) */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-400 to-orange-400 tracking-tighter drop-shadow-2xl py-2 select-none animate-shimmer-logo">
                        MANSUKE<br />WEREWOLF
                    </h1>
                    <div className="h-1 w-12 bg-gradient-to-r from-red-500 to-orange-500 mx-auto mt-4 rounded-full"></div>
                </div>

                {/* ローディング状態 */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-orange-500 rounded-full animate-spin-slow"></div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <p className="text-[10px] font-black tracking-[0.3em] text-red-400/60 uppercase">読み込み中</p>
                        <p className="text-sm font-bold tracking-widest text-gray-300 min-h-[1.5em] animate-pulse">
                            {message}
                        </p>
                    </div>
                </div>
            </div>

            {/* 下部装飾 */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-30">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-gray-600"></div>
                <span className="text-[10px] font-mono tracking-widest text-gray-300">MANSUKE WEREWOLF</span>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-gray-600"></div>
            </div>
        </div>
    );
};

export default LoadingScreen;
