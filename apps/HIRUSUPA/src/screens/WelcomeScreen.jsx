import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Search } from 'lucide-react';

const WelcomeScreen = ({ onNavigate }) => {

  // 機能選択カードの定義
  const features = [
    {
      id: 'formScreen',
      title: '連投を開始する',
      icon: <Zap size={48} />,
      // カード背景を白にし、薄いグレーの背景の上で浮き上がらせる
      color: 'bg-white text-blue-600 border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-xl',
      delay: 0.1
    },
    {
      id: 'search',
      title: '連投履歴を確認',
      icon: <Search size={48} />,
      // カード背景を白にし、薄いグレーの背景の上で浮き上がらせる
      color: 'bg-white text-emerald-600 border-slate-100 hover:border-emerald-200 shadow-sm hover:shadow-xl',
      delay: 0.2
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] w-full max-w-6xl mx-auto px-4 relative overflow-hidden">

      {/* 背景装飾 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />

      {/* タイトルエリア */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, type: "spring" }}
        className="text-center mb-16 relative z-10"
      >
        {/* 文字欠け防止のためにパディングを確保 (py-4 px-8) */}
        {/* 下マージン(mb-2)を削除して詰める */}
        <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none filter drop-shadow-sm py-4 px-8">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 pr-4">
            MANSUKE
          </span>
        </h1>
        {/* ネガティブマージン(-mt-8 md:-mt-12)を追加して、上の行のパディング分を相殺し視覚的に近づける */}
        <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none filter drop-shadow-sm py-4 px-8 -mt-8 md:-mt-12">
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 pr-4">
            HIRUSUPA
          </span>
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-lg md:text-xl text-slate-500 font-bold bg-white/80 backdrop-blur-sm py-2 px-8 rounded-full inline-block shadow-sm border border-slate-100"
        >
          Ver 5.0 [2026/02/23 公開]
        </motion.p>
      </motion.div>

      {/* カードエリア */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {features.map((feature) => (
          <motion.button
            key={feature.id}
            onClick={() => onNavigate(feature.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: feature.delay, duration: 0.5 }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative group flex flex-col items-center justify-center 
              p-10 h-80 rounded-3xl border transition-all duration-300
              ${feature.color}
            `}
          >
            {/* アイコン背景は薄いグレー */}
            <div className="mb-6 p-6 bg-slate-50 rounded-full shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              {feature.icon}
            </div>
            <h3 className="text-2xl font-bold text-center leading-relaxed whitespace-pre-wrap text-slate-700">
              {feature.title}
            </h3>
          </motion.button>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 text-xs text-slate-400 font-medium"
      >
        Copyright © 2026 MANSUKE - Organized by Cerinal Japan. All Rights Reserved.</motion.p>
    </div>
  );
};

export default WelcomeScreen;