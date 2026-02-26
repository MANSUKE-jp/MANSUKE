import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { QrCode, FilePlus2, ChevronRight } from 'lucide-react';

const MenuCard = ({ title, subtitle, icon: Icon, onClick, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClick}
            className="group relative flex-1 w-full h-[250px] md:h-[60vh] bg-[#111] border border-white/5 hover:border-[#d5b263]/50 rounded-3xl p-6 md:p-8 flex flex-col justify-between overflow-hidden transition-all duration-500 cursor-none"
            data-hover
        >
            {/* 背景のグラデーション */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 opacity-60" />
            <div className="absolute inset-0 bg-[#d5b263]/0 group-hover:bg-[#d5b263]/5 transition-colors duration-500" />

            {/* アイコン */}
            <div className="relative z-10 w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[#d5b263] group-hover:text-black transition-colors duration-300">
                <Icon size={24} className="md:w-8 md:h-8" />
            </div>

            {/* テキスト */}
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-white/40 font-mono text-xs tracking-widest mb-2 md:mb-3">
                    <span>{subtitle}</span>
                    <div className="h-[1px] w-8 bg-white/20" />
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-wide group-hover:text-[#d5b263] transition-colors">
                    {title}
                </h2>
            </div>

            {/* 矢印 */}
            <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 p-3 md:p-4 rounded-full border border-white/10 group-hover:border-[#d5b263] text-white/50 group-hover:text-[#d5b263] transition-all duration-300 transform group-hover:-rotate-45">
                <ChevronRight size={20} className="md:w-6 md:h-6" />
            </div>
        </motion.div>
    );
};

const Home = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen p-4 md:p-12 flex flex-col justify-center items-center">
            {/* 以前のヘッダータイトル部分は削除しました */}

            <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-7xl mx-auto mt-16 md:mt-0">
                <MenuCard
                    title="アクティベート"
                    subtitle="01 // POSレジ機能"
                    icon={QrCode}
                    onClick={() => navigate('/activate')}
                    delay={0.2}
                />
                <MenuCard
                    title="新規コード登録"
                    subtitle="02 // 管理者専用"
                    icon={FilePlus2}
                    onClick={() => navigate('/register')}
                    delay={0.4}
                />
            </div>
        </div>
    );
};

export default Home;