import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, StopCircle, CheckCircle, XCircle, Activity, Music2, User, KeyRound, Mail } from 'lucide-react';
import { ref, runTransaction } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import Button from '../components/Button.jsx';
import { CONFIG } from '../config/env.js';
import { fetchSongsByArtist } from '../logic/iTunesApi.js';
import { radioNameService } from '../logic/radioNameGen.js';
import { generateRandomEmail } from '../logic/emailGen.js';
import { proxyClient } from '../utils/proxyClient.js';
import { EquationSolver } from '../logic/solver/EquationSolver.js';
import { rtdb, functions } from '../config/firebase.js';
import { usePayment, PaymentModal } from '@mansuke/shared';

const ProcessingScreen = ({ formData, onStop, user }) => {
  // ステータス: 'preparing' | 'running' | 'stopping' | 'stopped' | 'error' | 'payment_required'
  const [status, setStatus] = useState('preparing');
  const [logs, setLogs] = useState([]);
  const [sendCount, setSendCount] = useState(0);
  const [totalCost, setTotalCost] = useState(0); // 発生料金を表示するための状態

  // 決済フック（途中の補充用）
  const payment = usePayment(functions);

  // 処理用データ保持
  const [songsPool, setSongsPool] = useState([]);
  // ループ内で最新のstateを参照するためのRef
  const songsPoolRef = useRef([]);

  // Ref
  const isRunningRef = useRef(true);
  const initializedRef = useRef(false); // 初期化済みフラグ
  // セッションID (課金グループ化用)
  const sessionIdRef = useRef(Math.random().toString(36).substring(2, 12));

  // 長押しボタン用
  const pressTimer = useRef(null);
  const [pressProgress, setPressProgress] = useState(0);

  // タイムアウト設定 (ミリ秒) - 20秒でタイムアウトとみなす
  const REQUEST_TIMEOUT_MS = 20000;

  // songsPoolが更新されたらRefも更新
  useEffect(() => {
    songsPoolRef.current = songsPool;
  }, [songsPool]);

  // ログ追加ヘルパー
  const addLog = useCallback((type, title, details, replaceId = null) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const newLog = { id: replaceId || Date.now(), timestamp, type, title, details };

    setLogs(prev => {
      if (replaceId) {
        const exists = prev.some(log => log.id === replaceId);
        if (exists) {
          return prev.map(log => log.id === replaceId ? newLog : log);
        }
      }
      // 最新の50件を保持
      return [newLog, ...prev].slice(0, 50);
    });
  }, []);

  // タイムアウト機能付きの実行ラッパー
  const withTimeout = (promise, ms, label = '処理') => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label}がタイムアウトしました`)), ms)
      )
    ]);
  };

  // --- Realtime Databaseのカウンターを更新する関数 ---
  const updateRealtimeCounters = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      const totalRef = ref(rtdb, 'stats/totalCount');
      const todayRef = ref(rtdb, `stats/dailyCounts/${today}`);

      // トランザクションで安全にカウントアップ
      runTransaction(totalRef, (currentCount) => (currentCount || 0) + 1);
      runTransaction(todayRef, (currentCount) => (currentCount || 0) + 1);
    } catch (e) {
      // silent
    }
  };

  // --- 1. 初期化・準備フェーズ ---
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      try {
        addLog('info', 'システム起動', '初期化処理を開始します...', 'init-system');

        // 1. 曲リストの準備
        if (formData.songSelectionType === 'random') {
          addLog('info', 'iTunes API', `「${formData.artistName}」の曲リストを取得中...`, 'init-music');
          const songs = await withTimeout(
            fetchSongsByArtist(formData.artistName),
            REQUEST_TIMEOUT_MS,
            'iTunes API'
          );
          setSongsPool(songs);
          addLog('success', '曲リスト取得完了', `${songs.length}曲を取得しました。`, 'init-music');
        } else {
          setSongsPool([formData.songName]);
          addLog('success', '曲情報設定完了', `指定曲: ${formData.songName}`, 'init-music');
        }

        // 2. ラジオネームの準備 (Geminiの場合)
        if (formData.radioNameType === 'gemini') {
          addLog('info', 'Gemini API', 'ラジオネームを生成中（15秒ほどかかります）...', 'init-radio');
          // サービス経由でバックエンドを呼び出し、残高チェックと生成を一度に行う
          await radioNameService.refill(sessionIdRef.current, formData.receiptId);
          setTotalCost(radioNameService.getAmount());
          addLog('success', 'ラジオネーム生成完了', `ラジオネーム第一弾を生成しました。`, 'init-radio');
        } else if (formData.radioNameType === 'random') {
          addLog('success', 'ラジオネーム設定', 'まんすけ乱数を使用します。', 'init-radio');
        } else {
          addLog('success', 'ラジオネーム設定', `固定ネーム: ${formData.manualRadioName}`, 'init-radio');
        }

        setStatus('running');
        addLog('success', '準備完了', '連投プロセスを開始します。', 'init-system');

      } catch (error) {
        // 残高不足などのエラー時は終了画面へ
        if (error.code === 'failed-precondition' || (error.message && error.message.includes('残高が不足'))) {
          addLog('error', '残高不足', 'Gemini APIを利用するための残高が不足しています。作成を終了します。', 'init-error');
          setTimeout(() => {
            handleStop();
          }, 3000);
          return;
        }
        setStatus('error');
        addLog('error', '初期化エラー', error.message || '不明なエラーが発生しました。', 'init-error');
      }
    };

    initialize();
  }, [formData, addLog]);


  // --- 2. 実行ループ ---
  useEffect(() => {
    if (status !== 'running') return;

    isRunningRef.current = true;
    addLog('info', '送信開始', '送信ループを開始しました...', 'loop-start');

    const solver = new EquationSolver();
    const targetConfig = formData.targetForm === 'production' ? CONFIG.FORMS.PRODUCTION : CONFIG.FORMS.DEMO;

    const loop = async () => {
      if (!isRunningRef.current) return;

      const processId = Date.now(); // 処理ごとのユニークID

      try {
        addLog('info', '処理中...', 'データを作成しています', `process-${processId}`);

        // --- A. GoogleフォームのHTML取得（不正対策がある場合のみ） ---
        let answer = "0";
        let problemText = "";

        if (targetConfig.FIELDS && targetConfig.FIELDS.ANTI_BOT) {
          const viewFormRes = await withTimeout(
            proxyClient.get(targetConfig.VIEW_URL),
            REQUEST_TIMEOUT_MS,
            'フォーム解析'
          );

          const regex = /(\d+)x\s*([+\-])\s*(\d+)\s*=\s*(\d+)/;
          const match = viewFormRes.data.match(regex);

          if (match) {
            problemText = match[0];
            answer = solver.solve(viewFormRes.data);
          } else {
            problemText = "問題なし";
            answer = "0";
          }
        }

        // --- B. 送信データの構築 ---
        const currentPool = songsPoolRef.current;
        const selectedSongTitle = currentPool && currentPool.length > 0
          ? currentPool[Math.floor(Math.random() * currentPool.length)]
          : (formData.songName || "Default Song");

        const currentSong = `${selectedSongTitle} / ${formData.artistName}`;
        const email = generateRandomEmail();

        let currentRadioName = "";
        if (formData.radioNameType === 'gemini') {
          try {
            // サービスから次の名前を取得（在庫が少なければ自動補充され、サーバー側で減算される）
            currentRadioName = await radioNameService.getNextName(sessionIdRef.current);
            setTotalCost(radioNameService.getAmount()); // 最新の発生料金を反映
          } catch (err) {
            if (err.message === "PAYMENT_REQUIRED") {
              addLog('info', '自動補充', '連投在庫が切れたため、バックグラウンド決済を実行して補充します...', `process-${processId}`);
              
              try {
                const processPaymentFn = httpsCallable(functions, 'processPayment');
                const result = await processPaymentFn({
                  amount: 5,
                  serviceId: 'hirusupa_gemini',
                  description: 'Geminiによるラジオネーム追加生成（最大100件）'
                });

                if (result.data && result.data.success) {
                  const receiptId = result.data.receiptId;
                  addLog('info', 'Gemini API', '自動決済完了。ラジオネームを追加生成中...', `process-${processId}`);
                  currentRadioName = await radioNameService.getNextName(sessionIdRef.current, receiptId);
                  setTotalCost(radioNameService.getAmount());
                  addLog('success', '自動補充完了', '在庫の補充が完了しました。連投を続行します。', `process-${processId}`);
                } else {
                  throw new Error("自動決済に失敗しました");
                }
              } catch (payErr) {
                addLog('error', '自動決済エラー', '残高不足などの理由で自動決済に失敗したため、連投を停止します。', `process-${processId}`);
                handleStop();
                return;
              }
            } else {
              throw err;
            }
          }
        } else if (formData.radioNameType === 'random') {
          currentRadioName = `まんすけ${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        } else {
          currentRadioName = formData.manualRadioName;
        }

        const params = new URLSearchParams();
        params.append(targetConfig.FIELDS.EMAIL, email);
        params.append(targetConfig.FIELDS.RADIO_NAME, currentRadioName);
        params.append(targetConfig.FIELDS.SONG, currentSong);

        if (targetConfig.FIELDS && targetConfig.FIELDS.ANTI_BOT) {
          params.append(targetConfig.FIELDS.ANTI_BOT, answer);
        }

        // --- C. 送信 ---
        addLog('info', '送信中...', `Googleフォームへデータを送信しています...`, `process-${processId}`);

        await withTimeout(
          proxyClient.post(targetConfig.URL, params),
          REQUEST_TIMEOUT_MS,
          'データ送信'
        );

        // --- C-2. 履歴保存 & カウンター更新 (Cloud Functions経由) ---
        const logSubmissionFn = httpsCallable(functions, 'logSubmission');

        await logSubmissionFn({
          artistName: formData.artistName,
          songName: currentSong,
          radioName: currentRadioName,
          targetForm: formData.targetForm,
          token: localStorage.getItem('mansuke_sso_token') // SSOトークンも念のため渡す
        }).catch(() => { });

        // --- D. ログ更新 ---
        setSendCount(prev => prev + 1);

        let logDetail = `EMAIL:${email}\nRN:${currentRadioName}\nSONG:${currentSong}`;
        if (problemText && problemText !== "問題なし") {
          logDetail += `\nPROBLEM:${problemText} (A: x=${answer})`;
        }

        addLog('success', '送信完了', logDetail, `process-${processId}`);

      } catch (error) {
        // 残高不足でエラーになった場合は、無理に再試行せずに連投を完全にストップします
        if (error.code === 'failed-precondition' || (error.message && error.message.includes('残高が不足'))) {
          addLog('error', '残高不足', '残高が不足したため、連投を停止します。', `process-${processId}`);
          handleStop();
          return;
        }

        const isTimeout = error.message && error.message.includes('タイムアウト');
        const errorMsg = isTimeout ? '応答なしのためスキップしました' : error.message;

        addLog('error', isTimeout ? 'タイムアウト' : '送信失敗', `再試行します... (${errorMsg})`, `process-${processId}`);
      } finally {
        if (isRunningRef.current) {
          setTimeout(loop, formData.interval * 1000);
        }
      }
    };

    loop();

    return () => {
      isRunningRef.current = false;
    };
  }, [status, formData, addLog]);


  // --- 停止ボタンの長押し処理 ---
  const handleMouseDown = () => {
    setPressProgress(0);
    pressTimer.current = setInterval(() => {
      setPressProgress(prev => {
        if (prev >= 100) {
          clearInterval(pressTimer.current);
          handleStop();
          return 100;
        }
        return prev + 1;
      });
    }, 20);
  };

  const handleMouseUp = () => {
    clearInterval(pressTimer.current);
    setPressProgress(0);
  };

  const handleStop = () => {
    isRunningRef.current = false;
    setStatus('stopped');
    // Gemini利用回数は「合計金額 / 5」で逆算して渡す
    onStop(sendCount, formData.radioNameType === 'gemini' ? radioNameService.getAmount() / 5 : 0);
  };

  const isTableMode = status !== 'preparing';

  const LogDetails = ({ text }) => {
    const lines = text.split('\n');
    return (
      <div className="flex flex-col gap-1 items-start">
        {lines.map((line, i) => {
          if (line.startsWith('EMAIL:')) {
            const email = line.replace('EMAIL:', '').trim();
            return (
              <div key={i} className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1 text-slate-700 font-medium bg-green-50 px-2 py-1 rounded border border-green-100">
                  <Mail size={14} className="text-green-600" />
                  {email}
                </div>
              </div>
            );
          }
          if (line.startsWith('RN:')) {
            const rn = line.replace('RN:', '').trim();
            return (
              <div key={i} className="-mt-2 mb-1">
                <div className="flex items-center gap-1 text-slate-700 font-medium bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                  <User size={14} className="text-indigo-600" />
                  {rn}
                </div>
              </div>
            );
          }
          if (line.startsWith('SONG:')) {
            const song = line.replace('SONG:', '').trim();
            return (
              <div key={i} className="-mt-2 mb-1">
                <div className="flex items-center gap-1 text-slate-700 font-medium bg-pink-50 px-2 py-1 rounded w-fit border border-pink-100">
                  <Music2 size={14} className="text-pink-600" />
                  {song}
                </div>
              </div>
            );
          }
          if (line.startsWith('PROBLEM:')) {
            const content = line.replace('PROBLEM:', '').trim();
            return (
              <div key={i} className="flex items-center gap-2 text-xs bg-slate-100 px-2 py-1 rounded w-fit mt-1 border border-slate-200">
                <KeyRound size={14} className="text-slate-500" />
                <span className="font-mono text-slate-600 font-bold">{content}</span>
              </div>
            );
          }
          return <span key={i} className="text-slate-500 text-sm">{line}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 overflow-hidden">
      <div className="w-full md:w-2/5 p-8 flex flex-col justify-center items-center bg-white shadow-2xl z-10 relative border-r border-slate-100">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-slate-800 mb-4">
            {status === 'preparing' && "連投システムを起動しています"}
            {status === 'running' && "連投を実行しています"}
            {status === 'error' && "エラーが発生しました"}
          </h2>
          <p className="text-slate-500 font-medium animate-pulse leading-relaxed whitespace-pre-wrap">
            {status === 'preparing' && "画面の裏側でさまざまな設定が行われています。\nもうしばらくお待ちください！"}
            {status === 'running' && "今ごろ放送部が頭を抱えています…"}
            {status === 'payment_required' && "追加のラジオネームを生成するための\n決済をお待ちしています..."}
          </p>
        </div>

        <div className="bg-slate-50 rounded-3xl p-8 w-full max-w-xs text-center border border-slate-100 mb-12">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">今回の送信回数</p>
          <div className="flex items-center justify-center gap-2 text-slate-800">
            <Send size={32} className="text-blue-600" />
            <span className="text-7xl font-black tracking-tighter">{sendCount}</span>
            <span className="text-xl font-bold text-slate-400 mt-6">回</span>
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          {totalCost > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center w-full max-w-xs mb-2">
              <p className="text-xs font-bold text-slate-500 mb-1">現在の発生料金</p>
              <div className="flex items-center justify-center gap-1 text-slate-800">
                <span className="text-2xl font-black">{totalCost}</span>
                <span className="text-sm font-bold text-slate-500">円</span>
              </div>
            </div>
          )}

          {status === 'error' ? (
            <Button onClick={() => onStop(0)} variant="secondary">戻る</Button>
          ) : (
            <div className="relative w-full max-w-xs">
              <button
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                className="relative overflow-hidden z-10 bg-red-500 text-white font-bold py-5 px-8 rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 transition-all w-full flex items-center justify-center gap-3"
              >
                <div
                  className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-red-700 to-red-900 opacity-80"
                  style={{ width: `${pressProgress}%`, transition: 'width 0.05s linear' }}
                />
                <div className="relative z-20 flex items-center gap-2">
                  <StopCircle size={24} />
                  送信を停止する (2秒長押し)
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-3/5 p-4 md:p-8 overflow-hidden flex flex-col bg-slate-50/50">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Activity size={20} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-600">
            {isTableMode ? '送信情報' : 'システムログ'}
          </span>
        </div>

        <div className="flex-1 overflow-hidden pr-2 pb-20 flex flex-col">
          {!isTableMode ? (
            <div className="overflow-y-auto h-full pr-2">
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`mb-3 p-5 rounded-2xl border border-slate-100 shadow-sm bg-white border-l-4 ${log.type === 'success' ? 'border-l-blue-500' :
                      log.type === 'error' ? 'border-l-red-500' : 'border-l-slate-400'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {log.type === 'success' && <CheckCircle size={18} className="text-blue-500" />}
                        {log.type === 'error' && <XCircle size={18} className="text-red-500" />}
                        {log.type === 'info' && <Loader2 size={18} className="text-slate-400 animate-spin" />}
                        <h4 className={`font-bold ${log.type === 'success' ? 'text-blue-600' : log.type === 'error' ? 'text-red-600' : 'text-slate-700'}`}>
                          {log.title}
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded-md">{log.timestamp}</span>
                    </div>
                    <div className="text-sm text-slate-600 pl-7 leading-relaxed whitespace-pre-wrap font-medium">{log.details}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="overflow-auto h-full w-full bg-white rounded-2xl border border-slate-100 shadow-sm">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap w-24">時刻</th>
                    <th className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap w-16 text-center">状態</th>
                    <th className="p-4 text-xs font-bold text-slate-500 whitespace-nowrap">詳細データ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-xs font-mono text-slate-500 align-top">{log.timestamp}</td>
                      <td className="p-4 text-center align-top">
                        {log.type === 'success' && <CheckCircle size={18} className="mx-auto text-blue-500" />}
                        {log.type === 'error' && <XCircle size={18} className="mx-auto text-red-500" />}
                        {log.type === 'info' && <Loader2 size={18} className="mx-auto text-slate-400 animate-spin" />}
                      </td>
                      <td className="p-4 text-sm text-slate-600 align-top"><LogDetails text={log.details} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 決済モーダル */}
      <PaymentModal
        isOpen={payment.isOpen}
        onClose={payment.handleClose}
        onConfirm={payment.handleConfirm}
        amount={payment.paymentConfig.amount}
        serviceName={payment.paymentConfig.serviceName}
        description={payment.paymentConfig.description}
        balance={user?.balance || 0}
        isLoading={payment.isProcessing}
      />
    </div>
  );
};

export default ProcessingScreen;