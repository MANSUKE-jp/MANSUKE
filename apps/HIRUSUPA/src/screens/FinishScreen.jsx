import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import { Home, CheckCircle2, Send } from 'lucide-react';

const FinishScreen = ({ count = 1250, geminiCalls = 0, onReset, generatedName }) => {
  // 保存処理が2回走らないようにするためのフラグ
  const isSaved = useRef(false);

  useEffect(() => {
    const autoSave = async () => {
      // 名前がない、または既に保存処理が走った場合は何もしない
      if (!generatedName || isSaved.current) return;

      isSaved.current = true; // 保存フラグを立てる

      try {

        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('../config/firebase');
        const saveRadioNameFn = httpsCallable(functions, 'saveRadioName');

        await saveRadioNameFn({
          name: generatedName,
          region: "osaka",
          userAgent: navigator.userAgent,
          token: localStorage.getItem('mansuke_sso_token')
        });
      } catch (e) {
        // silent
      }
    };

    autoSave();
  }, [generatedName]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 relative overflow-hidden">

      {/* 背景装飾 */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-slate-200 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-300 rounded-full blur-3xl opacity-30 animate-pulse delay-700" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        // カード背景を白にし、影をつける
        className="relative z-10 bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl shadow-slate-200/50 border border-white max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-green-100"
        >
          <CheckCircle2 size={48} className="text-green-500" />
        </motion.div>

        <h2 className="text-3xl font-black text-slate-800 mb-2">
          送信を停止しました
        </h2>
        <p className="text-slate-500 font-medium mb-8">
          放送部を悩ませることに成功しました。<br />
          これからも続けよう！！
        </p>

        <div className="bg-slate-50 rounded-2xl p-8 mb-8 border border-slate-100 shadow-inner flex flex-col gap-6">
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
              送信回数
            </p>
            <div className="flex items-center justify-center gap-2">
              <Send className="text-blue-600 mb-1" size={24} />
              <span className="text-6xl font-black text-slate-800 tracking-tight">
                {count}
              </span>
              <span className="text-xl font-bold text-slate-400 mt-4">回</span>
            </div>
          </div>

          {geminiCalls > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
                発生した料金
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-black text-slate-800 tracking-tight">
                  {geminiCalls * 5}
                </span>
                <span className="text-xl font-bold text-slate-400 mt-4">円</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                ※Gemini生成 {geminiCalls}回分
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={onReset}
          variant="primary"
          size="lg"
          className="w-full justify-center py-4 text-lg shadow-lg shadow-blue-200"
        >
          <Home size={20} />
          最初の画面に戻る
        </Button>
      </motion.div>
    </div>
  );
};

export default FinishScreen;