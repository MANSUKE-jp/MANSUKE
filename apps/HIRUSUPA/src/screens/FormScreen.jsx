import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';
import Input from '../components/Input';
import ProgressBar from '../components/ProgressBar';
import { CONFIG } from '../config/env';
import { searchArtists, searchTracks } from '../logic/iTunesApi';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles, User, Keyboard, Send, Mic2, Music, Shuffle, AlertTriangle, Lock, X, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { usePayment, PaymentModal } from '@mansuke/shared';
import { functions } from '../config/firebase.js';

const FormScreen = ({ onBack, onSubmit, user, refreshBalance, isBalanceLoading }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const [direction, setDirection] = useState(1); // 1: next, -1: prev

  // フォームデータ
  const [data, setData] = useState({
    artistName: '',
    artistImage: null, // 表示用に追加
    songSelectionType: null, // 'random' | 'manual'
    songName: '', // 手動入力の場合の値
    songImage: null, // 表示用に追加
    interval: 3,
    radioNameType: 'random', // 'gemini' | 'random' | 'manual'
    manualRadioName: '',
    targetForm: 'production' // 'production' | 'demo'
  });

  // 検索用の一時ステート
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 管理者認証モーダルの状態
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Gemini課金同意モーダルの状態
  const [showGeminiModal, setShowGeminiModal] = useState(false);

  // 決済フック
  const payment = usePayment(functions);

  // MANSUKEアカウントの情報から表示名を決定
  const fullName = user?.name || (user?.lastName && user?.firstName
    ? `${user.lastName} ${user.firstName}`
    : user?.displayName || user?.email || "ゲスト");

  // 入力ハンドラ
  const handleChange = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  // 検索ハンドラ
  const handleSearch = async (type) => {
    if (!searchKeyword.trim()) return;

    setIsSearching(true);
    setSearchError('');
    // 検索し直す場合はリストをリセット（選択状態も視覚的にはリセットされるがデータは保持）
    setSearchResults([]);

    try {
      if (type === 'artist') {
        const results = await searchArtists(searchKeyword);
        if (results.length === 0) throw new Error('見つかりませんでした');
        setSearchResults(results);
      } else if (type === 'song') {
        // アーティスト名も含めて検索すると精度が上がります
        const query = data.artistName ? `${searchKeyword} ${data.artistName}` : searchKeyword;
        // 第2引数に選択中のアーティスト名を渡し、そのアーティストの曲に限定する
        const results = await searchTracks(query, data.artistName);
        if (results.length === 0) throw new Error('見つかりませんでした');
        setSearchResults(results);
      }
    } catch (err) {
      setSearchError('見つかりませんでした。キーワードを変えて試してください。');
    } finally {
      setIsSearching(false);
    }
  };

  // デモフォーム選択時のハンドラ
  const handleDemoSelect = () => {
    if (data.targetForm === 'demo') return;

    // モーダルを開く準備
    setAuthInput('');
    setAuthError('');
    setShowAuthModal(true);
  };

  // 認証実行
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (authInput === CONFIG.AUTH_ID) {
      handleChange('targetForm', 'demo');
      setShowAuthModal(false);
    } else {
      setAuthError('認証コードが正しくありません。');
    }
  };

  // ステップ移動
  const nextStep = () => {
    if (step < totalSteps) {
      // --- 整合性チェック: 曲が手動指定の場合、ラジオネームの手動指定を解除する ---
      if (step === 2 && data.songSelectionType === 'manual') {
        if (data.radioNameType === 'manual') {
          handleChange('radioNameType', 'gemini');
          handleChange('manualRadioName', '');
        }
      }
      // -----------------------------------------------------------------------

      // ステップ変更時のクリーンアップ（検索状態のリセット）
      setSearchKeyword('');
      setSearchResults([]);
      setSearchError('');

      setDirection(1);
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    // ステップ変更時のクリーンアップ
    setSearchKeyword('');
    setSearchResults([]);
    setSearchError('');

    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    } else {
      onBack();
    }
  };

  // バリデーション
  const isStepValid = () => {
    switch (step) {
      case 1:
        return data.artistName.trim().length > 0;
      case 2:
        if (data.songSelectionType === 'random') return true;
        if (data.songSelectionType === 'manual') return data.songName.trim().length > 0;
        return false;
      case 3:
        return data.interval >= 3;
      case 4:
        return data.radioNameType !== 'manual' || data.manualRadioName.trim().length > 0;
      case 5:
        return true;
      default:
        return true;
    }
  };

  // 最終送信
  const handleFinalSubmit = () => {
    const finalData = {
      ...data,
      songName: data.songSelectionType === 'random' ? null : data.songName
    };

    if (finalData.radioNameType === 'gemini') {
      payment.requestPayment({
        amount: 5, // Actually unconfirmed, but kept to fulfill prop requirements
        serviceName: 'HIRUSUPA',
        description: 'Geminiによるラジオネーム自動生成（最大100件）\n※生成されるごとに自動で5円が加算されます。\n※最終的な合計金額は停止時にお知らせします。',
        isPreApproval: true, // NEW: Skip immediate background charge
        onSuccess: (receiptId) => {
          onSubmit({ ...finalData, receiptId });
        },
        onError: () => {
          // payment cancelled or error - silent
        }
      });
    } else {
      onSubmit(finalData);
    }
  };

  // アニメーション設定
  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  // 曲が手動指定されているかどうかのフラグ
  const isSongManual = data.songSelectionType === 'manual';

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-8 relative">
      <ProgressBar currentStep={step} totalSteps={totalSteps} />

      <div className="relative min-h-[400px]">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute w-full top-0 left-0"
          >
            {/* --- STEP 1: アーティスト名 (検索選択式) --- */}
            {step === 1 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="mb-4 flex justify-center">
                  <div className="bg-indigo-50 p-3 rounded-full text-indigo-500">
                    <Mic2 size={32} />
                  </div>
                </div>

                <label className="block text-slate-800 font-bold text-lg mb-2">
                  アーティストを検索して選択してください
                </label>
                <div className="flex gap-2 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="例：ONE OK ROCK"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className="mb-0"
                    />
                  </div>
                  <Button
                    onClick={() => handleSearch('artist')}
                    disabled={isSearching || !searchKeyword}
                    className="h-[52px] shadow-lg shadow-blue-100"
                  >
                    {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                  </Button>
                </div>

                {searchError && (
                  <p className="text-red-500 text-sm mb-4 text-center">{searchError}</p>
                )}

                {/* 検索結果リスト */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar pb-2">
                  {/* 既に選択済みのアーティストがリストにない場合でも、選択中であることを表示するエリアがあっても良いが、
                      今回は「リストから選ぶ」体験を重視し、リスト内でのハイライトで表現する。
                      もしリストが空（未検索）で、データが既にある場合は、初期表示としてそれを表示しても良いかもしれない。
                  */}
                  {searchResults.map((artist) => {
                    const isSelected = data.artistName === artist.name;
                    return (
                      <div
                        key={artist.id}
                        onClick={() => {
                          handleChange('artistName', artist.name);
                          handleChange('artistImage', artist.image);
                        }}
                        className={`
                          flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                            : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-sm'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute top-0 right-0 bg-blue-500 text-white p-1 rounded-bl-xl shadow-sm z-10">
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                        <img
                          src={artist.image}
                          alt={artist.name}
                          className="w-14 h-14 rounded-full object-cover bg-slate-200 shadow-sm shrink-0"
                          onError={(e) => e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E"}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                            {artist.name}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">{artist.genre}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* リストが空で、かつ選択済みのデータがある場合（再編集時など）の表示 */}
                  {searchResults.length === 0 && data.artistName && !isSearching && (
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-blue-200 border-dashed">
                      <p className="text-sm text-slate-500 mb-2">現在選択中</p>
                      <div className="flex items-center justify-center gap-3">
                        {data.artistImage && (
                          <img src={data.artistImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                        )}
                        <span className="font-bold text-slate-800 text-lg">{data.artistName}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">変更するには新しいキーワードで検索してください</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- STEP 2: 曲名の指定方法 --- */}
            {step === 2 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <label className="block text-slate-800 font-bold text-lg mb-4">曲名はどうしますか？</label>

                <div className="space-y-3">
                  <SelectionCard
                    selected={data.songSelectionType === 'random'}
                    onClick={() => {
                      handleChange('songSelectionType', 'random');
                      handleChange('songName', '');
                      handleChange('songImage', null);
                      setSearchResults([]);
                      setSearchKeyword('');
                    }}
                    icon={<Shuffle className="text-purple-500" />}
                    title={`${data.artistName}の曲からランダム`}
                    desc={`Apple Musicにある${data.artistName}の曲からランダムに選択します。`}
                  />
                  <SelectionCard
                    selected={data.songSelectionType === 'manual'}
                    onClick={() => {
                      handleChange('songSelectionType', 'manual');
                    }}
                    icon={<Music className="text-blue-500" />}
                    title="自分で1曲指定する"
                    desc="特定の1曲を検索して指定します。"
                  />
                </div>

                {/* 手動入力（検索・選択式） */}
                {data.songSelectionType === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 pt-6 border-t border-slate-50"
                  >
                    <label className="block text-slate-700 font-bold text-sm mb-2">曲を検索して選択してください</label>
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1">
                        <Input
                          placeholder="例：Delusion:All"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          className="mb-0"
                        />
                      </div>
                      <Button
                        onClick={() => handleSearch('song')}
                        disabled={isSearching || !searchKeyword}
                        className="h-[52px] shadow-lg shadow-blue-100"
                      >
                        {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                      </Button>
                    </div>

                    {searchError && (
                      <p className="text-red-500 text-sm mb-4 text-center">{searchError}</p>
                    )}

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar pb-2">
                      {searchResults.map((song) => {
                        const isSelected = data.songName === song.name;
                        return (
                          <div
                            key={song.id}
                            onClick={() => {
                              handleChange('songName', song.name);
                              handleChange('songImage', song.image);
                            }}
                            className={`
                              flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden
                              ${isSelected
                                ? 'border-pink-500 bg-pink-50 shadow-md ring-2 ring-pink-200'
                                : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-sm'
                              }
                            `}
                          >
                            {isSelected && (
                              <div className="absolute top-0 right-0 bg-pink-500 text-white p-1 rounded-bl-xl shadow-sm z-10">
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                            <img
                              src={song.image}
                              alt={song.name}
                              className="w-14 h-14 rounded-lg object-cover bg-slate-200 shadow-sm shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-bold truncate ${isSelected ? 'text-pink-800' : 'text-slate-800'}`}>
                                {song.name}
                              </h4>
                              <p className="text-xs text-slate-500 truncate">{song.artist} - {song.album}</p>
                            </div>
                          </div>
                        );
                      })}

                      {/* リストが空で、かつ選択済みのデータがある場合（再編集時など）の表示 */}
                      {searchResults.length === 0 && data.songName && !isSearching && (
                        <div className="text-center p-4 bg-slate-50 rounded-xl border border-pink-200 border-dashed">
                          <p className="text-sm text-slate-500 mb-2">現在選択中</p>
                          <div className="flex items-center justify-center gap-3">
                            {data.songImage && (
                              <img src={data.songImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            )}
                            <span className="font-bold text-slate-800 text-lg">{data.songName}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">変更するには新しいキーワードで検索してください</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* --- STEP 3: 送信間隔 --- */}
            {step === 3 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <label className="block text-slate-800 font-bold text-lg mb-1">連投間隔を選択してください。</label>
                <p className="text-sm text-slate-500 mb-6">デフォルトは3秒、最小設定数は3秒です。</p>

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleChange('interval', Math.max(3, data.interval - 1))}
                    className="w-12 h-12 rounded-full bg-slate-50 text-slate-600 font-bold text-xl hover:bg-slate-100 transition-colors shadow-sm border border-slate-100"
                  >
                    -
                  </button>
                  <div className="text-4xl font-black text-blue-600 w-24 text-center">
                    {data.interval}<span className="text-lg text-slate-400 font-medium ml-1">秒</span>
                  </div>
                  <button
                    onClick={() => handleChange('interval', data.interval + 1)}
                    className="w-12 h-12 rounded-full bg-slate-50 text-slate-600 font-bold text-xl hover:bg-slate-100 transition-colors shadow-sm border border-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 4: ラジオネーム --- */}
            {step === 4 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">


                <label className="block text-slate-800 font-bold text-lg mb-4">ラジオネームはどうしますか？</label>

                <div className="mb-6">
                  <h4 className="font-bold text-slate-500 text-sm mb-3 ml-1 flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-black">無料</span>
                    標準機能
                  </h4>
                  <div className="space-y-3">
                    <SelectionCard
                      selected={data.radioNameType === 'random'}
                      onClick={() => handleChange('radioNameType', 'random')}
                      icon={<User className="text-blue-500" />}
                      title="まんすけ乱数"
                      desc="「まんすけ + 3桁の乱数」で連投します。"
                    />
                    <SelectionCard
                      selected={data.radioNameType === 'manual'}
                      // 曲が手動指定(isSongManual)の場合はクリック無効
                      onClick={() => !isSongManual && handleChange('radioNameType', 'manual')}
                      icon={<Keyboard className={isSongManual ? "text-slate-400" : "text-orange-500"} />}
                      title="自分で指定する"
                      desc={isSongManual ? "※曲名を指定している場合、ラジオネームは指定できません。" : "好きなラジオネームで連投し続けます。"}
                      disabled={isSongManual} // disabledフラグを渡す
                    />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-500 text-sm mb-3 ml-1 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-black">有料</span>
                    Gemini生成
                  </h4>
                  <div className="space-y-3">
                    <SelectionCard
                      selected={data.radioNameType === 'gemini'}
                      onClick={() => {
                        if (data.radioNameType !== 'gemini') {
                          if (refreshBalance) refreshBalance();
                          setShowGeminiModal(true);
                        }
                      }}
                      icon={
                        <div className="flex flex-col items-center">
                          <Sparkles className="text-purple-500 mb-1" size={18} />
                          <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-1.5 rounded">¥</span>
                        </div>
                      }
                      title="Geminiで生成"
                      desc="Gemini AIでラジオネームを毎回生成します。"
                    />
                  </div>
                </div>

                {data.radioNameType === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-slate-50"
                  >
                    <Input
                      label="ラジオネームを入力してください。"
                      placeholder="例：伝説のまんすけ"
                      value={data.manualRadioName}
                      onChange={(e) => handleChange('manualRadioName', e.target.value)}
                      autoFocus
                    />
                  </motion.div>
                )}
              </div>
            )}

            {/* --- STEP 5: 送信先 --- */}
            {step === 5 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <label className="block text-slate-800 font-bold text-lg mb-4">送信先を指定してください。</label>

                <div className="space-y-3">
                  <SelectionCard
                    selected={data.targetForm === 'production'}
                    onClick={() => handleChange('targetForm', 'production')}
                    icon={<Send className="text-blue-600" />}
                    title="昼スパリクエストフォーム"
                    desc="近畿大学附属高等学校の放送部です..."
                  />
                  <SelectionCard
                    selected={data.targetForm === 'demo'}
                    onClick={handleDemoSelect} // ここを変更：直接変更せずハンドラを呼び出す
                    icon={<RotateCcw className={data.targetForm === 'demo' ? "text-green-600" : "text-slate-400"} />}
                    title="動作確認用デモフォーム"
                    desc={data.targetForm === 'demo' ? "テスト送信に使用します。" : "開発チームが独自に制作したデモフォームです。"}
                    locked={data.targetForm !== 'demo'} // 鍵アイコンを表示するためのフラグ
                  />
                </div>
              </div>
            )}

            {/* --- STEP 6: 確認画面 --- */}
            {step === 6 && (
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
                <h3 className="text-2xl font-bold text-slate-800 mb-6">以下の情報をもとに連投します。<br />よろしいですか？</h3>

                {/* 選択した画像を表示するエリア */}
                <div className="flex justify-center gap-4 mb-6">
                  {data.artistImage && (
                    <div className="relative">
                      <img src={data.artistImage} alt="Artist" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg" />
                      <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1 rounded-full text-xs font-bold px-2 border-2 border-white">Artist</div>
                    </div>
                  )}
                  {data.songImage && (
                    <div className="relative">
                      <img src={data.songImage} alt="Song" className="w-20 h-20 rounded-lg object-cover border-4 border-white shadow-lg" />
                      <div className="absolute -bottom-2 -right-2 bg-pink-500 text-white p-1 rounded-full text-xs font-bold px-2 border-2 border-white">Song</div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-6 text-left space-y-4 mb-8 border border-slate-100">
                  <ConfirmItem label="アーティスト" value={data.artistName} />
                  <ConfirmItem
                    label="曲名"
                    value={
                      data.songSelectionType === 'random'
                        ? `「${data.artistName}」の曲からランダム`
                        : data.songName
                    }
                  />
                  <ConfirmItem label="送信間隔" value={`${data.interval}秒`} />
                  <ConfirmItem
                    label="ラジオネーム"
                    value={
                      data.radioNameType === 'gemini' ? 'Gemini生成' :
                        data.radioNameType === 'random' ? 'まんすけ乱数' :
                          data.manualRadioName
                    }
                  />
                  <ConfirmItem
                    label="送信先"
                    value={data.targetForm === 'production' ? '昼スパリクエストフォーム' : 'デモフォーム'}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleFinalSubmit}
                    variant="primary"
                    size="lg"
                    className="w-full justify-center shadow-blue-200 shadow-xl"
                  >
                    <Send size={20} />
                    連投を開始する！
                  </Button>
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    size="md"
                    className="w-full justify-center border-none text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  >
                    最初から設定をやり直す
                  </Button>
                </div>
              </div>
            )}

            {/* ナビゲーションボタン（最終画面以外） */}
            {step !== 6 && (
              <div className="flex justify-between mt-8">
                <Button
                  onClick={prevStep}
                  variant="secondary"
                  className="px-6 bg-slate-200 hover:bg-slate-300 border-none text-slate-600"
                >
                  <ArrowLeft size={18} />
                  戻る
                </Button>

                <Button
                  onClick={nextStep}
                  variant="primary"
                  disabled={!isStepValid()}
                  className="px-8 shadow-lg shadow-blue-100"
                >
                  次へ
                  <ArrowRight size={18} />
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- Gemini同意モーダル --- */}
      <AnimatePresence>
        {showGeminiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* バックドロップ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGeminiModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* モーダルコンテンツ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100"
            >
              <div className="flex flex-col items-center mb-6 text-center">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-600">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Geminiによる生成には<br />料金が発生します</h3>
                <p className="text-xl font-bold text-purple-600 mb-2 bg-purple-50 px-4 py-2 rounded-xl">ラジオネームを100個<br />生成するごとに5円</p>
                <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">
                  <span className="text-blue-800 text-sm font-medium">
                    現在のアカウント残高：
                    <span className="text-blue-600 text-base ml-1">
                      {isBalanceLoading ? "取得中..." : `${user?.balance || 0} 円`}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  連投を開始するときに、最初の100個分のラジオネーム生成料金（5円）をお支払いいただきます。<br />
                  また、途中で補充が必要になった際も都度お支払いが発生します。<br />
                  アカウント残高が5円未満になった場合は自動的に連投を停止します。
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 w-full mb-6">
                  <p className="text-xs text-slate-500 font-medium whitespace-pre-wrap">
                    {fullName} 様のMANSUKEアカウントにログインしています
                  </p>
                </div>
              </div>

              {(user?.balance || 0) < 5 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                  <AlertTriangle size={20} className="shrink-0" />
                  <p className="text-sm font-bold">残高不足のため利用できません。</p>
                </div>
              )}

              <div className="flex gap-3 w-full">
                {((user?.balance || 0) >= 5) ? (
                  <>
                    <Button
                      onClick={() => setShowGeminiModal(false)}
                      variant="secondary"
                      className="flex-1 justify-center bg-slate-100 text-slate-600 border-none hover:bg-slate-200"
                    >
                      キャンセル
                    </Button>
                    <Button
                      onClick={() => {
                        handleChange('radioNameType', 'gemini');
                        setShowGeminiModal(false);
                      }}
                      variant="primary"
                      className="flex-1 justify-center shadow-lg shadow-purple-200 bg-purple-600 hover:bg-purple-700 border-none"
                    >
                      同意する
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setShowGeminiModal(false)}
                    variant="secondary"
                    className="w-full justify-center bg-slate-100 text-slate-600 border-none hover:bg-slate-200"
                  >
                    キャンセル
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 管理者認証モーダル --- */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* バックドロップ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* モーダルコンテンツ */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100"
            >
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-600">
                  <Lock size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 text-center">この先は<br />管理者権限が必要です</h3>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <Input
                  label="問題：CerinalのWeWork Auth IDは？"
                  placeholder="解答を入力..."
                  type="password"
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  error={authError}
                  className="mb-6"
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center shadow-lg shadow-blue-100"
                >
                  認証する
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

// サブコンポーネント: 選択カード
// disabledプロパティを追加し、クリック無効化とスタイル変更を実装
const SelectionCard = ({ selected, onClick, icon, title, desc, locked, disabled }) => (
  <div
    // disabledの場合はクリックを無効化
    onClick={!disabled ? onClick : undefined}
    className={`
      flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 relative
      ${disabled
        ? 'border-slate-100 bg-slate-100 opacity-50 cursor-not-allowed grayscale' // 無効化時のスタイル
        : 'cursor-pointer ' + (selected
          ? 'border-blue-500 bg-blue-50/50'
          : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-white'
        )
      }
    `}
  >
    <div className={`p-3 rounded-full ${selected && !disabled ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <h4 className={`font-bold ${selected && !disabled ? 'text-blue-700' : 'text-slate-700'}`}>{title}</h4>
        {locked && <Lock size={14} className="text-slate-400" />}
      </div>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
    {selected && !disabled && <Check className="text-blue-500" size={20} />}
  </div>
);

// サブコンポーネント: 確認項目
const ConfirmItem = ({ label, value }) => (
  <div className="flex justify-between items-center border-b border-slate-200/50 last:border-0 pb-2 last:pb-0">
    <span className="text-sm text-slate-400 font-medium">{label}</span>
    <span className="text-base text-slate-800 font-bold max-w-[60%] text-right truncate">{value}</span>
  </div>
);

export default FormScreen;