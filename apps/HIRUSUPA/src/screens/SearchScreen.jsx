import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';
import Input from '../components/Input';
import { searchArtists, searchTracks } from '../logic/iTunesApi';
import { Search, ArrowLeft, Clock, User, Music2, AlertCircle, Filter, Home, Loader2, X, TrendingUp, Trophy, Activity, ArrowRight, Mic, Disc, CheckCircle2, SlidersHorizontal, BarChart2 } from 'lucide-react';
import { db, rtdb, functions } from '../config/firebase';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';

/**
 * 履歴検索＆ダッシュボード画面
 */
export const SearchScreen = ({ onBack }) => {
  const [mode, setMode] = useState('dashboard');

  const variants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col min-h-screen">
      <AnimatePresence mode="wait">
        {mode === 'dashboard' ? (
          <motion.div
            key="dashboard"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <DashboardView
              onNavigateToSearch={() => setMode('search')}
              onBack={onBack}
            />
          </motion.div>
        ) : (
          <motion.div
            key="search"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <SearchView
              onBackToDashboard={() => setMode('dashboard')}
              onBackToHome={onBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ダッシュボードコンポーネント
 * 統計情報や週間推移を表示します
 */
const DashboardView = ({ onNavigateToSearch, onBack }) => {
  // カウンター用のstate (RTDBから取得)
  const [counts, setCounts] = useState({
    total: 0,
    today: 0,
    loaded: false
  });

  // 週間統計用のstate
  const [weeklyStats, setWeeklyStats] = useState({
    loading: true,
    data: [] // { date: '2026-02-12', label: '02/12', count: 150 }
  });

  // --- 1. RTDBからカウンターをリアルタイム監視 ---
  useEffect(() => {
    const statsRef = ref(rtdb, 'stats');

    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      const todayKey = new Date().toISOString().split('T')[0];
      const todayCount = data?.dailyCounts?.[todayKey] || 0;
      const totalCount = data?.totalCount || 0;

      setCounts({
        total: totalCount,
        today: todayCount,
        loaded: true
      });
    }, () => {
      setCounts(prev => ({ ...prev, loaded: true }));
    });

    return () => unsubscribe();
  }, []);

  // --- 2. Firestoreの件数だけを取得してRTDBを補正 ---
  useEffect(() => {
    const syncFromFirestore = async () => {
      try {
        const historyRef = collection(db, "history");
        const totalSnapshot = await getCountFromServer(historyRef);
        const total = totalSnapshot.data().count;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayQuery = query(historyRef, where("sentAt", ">=", Timestamp.fromDate(todayStart)));
        const todaySnapshot = await getCountFromServer(todayQuery);
        const today = todaySnapshot.data().count;

        if (total > 0) {
          const todayKey = new Date().toISOString().split('T')[0];
          set(ref(rtdb, 'stats/totalCount'), total);
          set(ref(rtdb, `stats/dailyCounts/${todayKey}`), today);
        }
      } catch (e) {
        // silent
      }
    };
    syncFromFirestore();
  }, []);

  // --- 3. 週間統計の取得 (getRankingsから変更) ---
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Cloud Functionsを呼び出し (getWeeklyStats)
        const getWeeklyStats = httpsCallable(functions, 'getWeeklyStats');
        const result = await getWeeklyStats();

        setWeeklyStats({
          loading: false,
          data: result.data
        });

      } catch (error) {
        setWeeklyStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* ヘッダーエリア */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            連投ダッシュボード
          </h2>
          <p className="text-slate-500 font-medium mt-1 ml-11">
            Ver2.1以降の連投履歴が表示されます。<br />
            演算処理をサーバーに移行したので、だいぶ爆速になりました！！
          </p>
        </div>
        <Button onClick={onBack} variant="secondary" size="sm" className="bg-white border border-slate-200 self-start md:self-center">
          <Home size={16} />
          ホームへ
        </Button>
      </div>

      {!counts.loaded ? (
        <div className="flex flex-col justify-center items-center h-96 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
          <p className="text-slate-400 font-bold">データを読み込み中...</p>
        </div>
      ) : (
        <>
          {/* 上段：カウント表示 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 総連投数 */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg shadow-blue-200 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 rotate-12">
                <SendIcon size={160} />
              </div>
              <div className="relative z-10">
                <p className="text-blue-100 font-bold text-lg mb-2 flex items-center gap-2">
                  <Trophy size={20} /> 総連投回数
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black tracking-tighter">
                    {counts.total.toLocaleString()}
                  </span>
                  <span className="text-xl font-bold opacity-80">回</span>
                </div>
              </div>
            </div>

            {/* 今日の連投数 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col justify-between relative overflow-hidden group hover:border-blue-200 transition-colors">
              <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-bl from-green-50 to-transparent rounded-bl-full opacity-60"></div>
              <div className="relative z-10">
                <p className="text-slate-500 font-bold text-lg mb-2 flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-500" /> 今日の連投回数
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black text-slate-800 tracking-tighter">
                    {counts.today.toLocaleString()}
                  </span>
                  <span className="text-xl font-bold text-slate-400">回</span>
                </div>
              </div>
            </div>
          </div>

          {/* 中段：週間統計グラフ (Ranking廃止 -> Weekly Statsへ) */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 relative">
            {weeklyStats.loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center rounded-3xl">
                <div className="text-center">
                  <Loader2 className="animate-spin text-slate-300 mx-auto mb-2" size={32} />
                  <p className="text-xs text-slate-400 font-bold">統計データを取得中...</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><BarChart2 size={20} /></span>
                週間アクティビティ
              </h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">過去7日間</span>
            </div>

            {/* 棒グラフエリア */}
            <div className="w-full">
              {weeklyStats.data.length > 0 ? (
                <div className="flex items-end justify-between h-64 gap-2 sm:gap-4 px-2 pt-8 pb-2">
                  {weeklyStats.data.map((item, index) => {
                    // グラフの最大値を計算（最低でも10にして見た目を整える）
                    const maxCount = Math.max(...weeklyStats.data.map(d => d.count), 10);
                    // 高さのパーセンテージを計算
                    const heightPercent = Math.max((item.count / maxCount) * 100, 2); // 最低2%は表示
                    const isToday = index === 6; // 配列の最後が今日

                    return (
                      <div key={item.date} className="flex flex-col items-center flex-1 group relative">
                        {/* ツールチップ的な数値表示 */}
                        <div className={`
                             absolute -top-8 text-xs font-black transition-all duration-300 transform
                             ${isToday ? 'text-blue-600 scale-110' : 'text-slate-500 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'}
                           `}>
                          {item.count}回
                        </div>

                        {/* 棒 */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1, type: "spring", stiffness: 100 }}
                          className={`
                                w-full max-w-[40px] rounded-t-lg min-h-[4px] relative
                                ${isToday
                              ? 'bg-gradient-to-t from-blue-500 to-indigo-500 shadow-md shadow-blue-200'
                              : 'bg-slate-100 group-hover:bg-blue-300'
                            } 
                                transition-colors duration-300
                              `}
                        />

                        {/* 日付ラベル */}
                        <div className={`mt-3 text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                          {item.label}
                        </div>

                        {/* 今日のマーク */}
                        {isToday && (
                          <div className="absolute -bottom-6 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                            TODAY
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                  データがありません
                </div>
              )}
            </div>

            <div className="mt-8 text-right">
              <p className="text-xs text-slate-400 font-medium">
                ※ デバッグできていないので、データが正確ではない可能性があります
              </p>
            </div>
          </div>

          {/* 検索への遷移ボタン */}
          <div className="pt-2">
            <button
              onClick={onNavigateToSearch}
              className="w-full group relative bg-white border-2 border-slate-100 hover:border-blue-400 rounded-3xl p-6 flex items-center justify-between shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                  <Search size={28} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">連投履歴を検索する</h3>
                  <p className="text-slate-400 text-sm">過去の連投履歴を検索します。</p>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-full text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <ArrowRight size={24} />
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};


/**
 * 検索機能コンポーネント（Cloud Functions検索版）
 */
const SearchView = ({ onBackToDashboard, onBackToHome }) => {
  // 検索条件
  const [searchParams, setSearchParams] = useState({
    artistName: '',
    songName: '',
    radioName: '',
    excludeMansuke: false
  });

  // 選択中の画像
  const [selectedImages, setSelectedImages] = useState({
    artist: null,
    song: null
  });

  // iTunes検索モーダル用
  const [iTunesSearch, setITunesSearch] = useState({
    type: null, // 'artist' | 'song' | null
    keyword: '',
    results: [],
    loading: false,
    error: ''
  });

  // 検索結果データ (Cloud Functionsから取得)
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 条件があるかどうか
  const hasCondition = searchParams.artistName || searchParams.songName || searchParams.radioName || searchParams.excludeMansuke;

  // Cloud Functions検索実行
  const executeCloudSearch = useCallback(async () => {
    // 条件がない場合は何もしない
    if (!hasCondition) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchHistory = httpsCallable(functions, 'searchHistory');
      const response = await searchHistory(searchParams);

      // 結果の整形 (ISOStringの日付をDateオブジェクトに戻す)
      const formattedResults = response.data.map(item => ({
        ...item,
        sentAt: item.sentAt ? new Date(item.sentAt) : new Date()
      }));

      setResults(formattedResults);
    } catch (error) {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, [searchParams, hasCondition]);

  // デバウンス処理: 検索条件が変わってから少し待ってCloud Functionsを実行
  useEffect(() => {
    const timerId = setTimeout(() => {
      executeCloudSearch();
    }, 800); // 文字入力などの連続変更を待つため、少し長めの800ms

    return () => clearTimeout(timerId);
  }, [executeCloudSearch]);


  // iTunes検索を開く
  const openITunesSearch = (type) => {
    setITunesSearch({
      type,
      keyword: '',
      results: [],
      loading: false,
      error: ''
    });
  };

  // iTunes検索実行 (Functions経由)
  const executeITunesSearch = useCallback(async (searchKeyword) => {
    if (!searchKeyword.trim()) {
      setITunesSearch(prev => ({ ...prev, results: [], loading: false }));
      return;
    }

    setITunesSearch(prev => ({ ...prev, loading: true, error: '', results: [] }));

    try {
      let data = [];
      if (iTunesSearch.type === 'artist') {
        data = await searchArtists(searchKeyword);
      } else {
        const query = searchParams.artistName
          ? `${searchKeyword} ${searchParams.artistName}`
          : searchKeyword;
        data = await searchTracks(query, searchParams.artistName);
      }
      setITunesSearch(prev => ({ ...prev, results: data }));
    } catch (e) {
      setITunesSearch(prev => ({ ...prev, error: "エラーが発生しました。" }));
    } finally {
      setITunesSearch(prev => ({ ...prev, loading: false }));
    }
  }, [iTunesSearch.type, searchParams.artistName]);

  // iTunes検索のデバウンス
  useEffect(() => {
    const timerId = setTimeout(() => {
      if (iTunesSearch.keyword) {
        executeITunesSearch(iTunesSearch.keyword);
      } else {
        setITunesSearch(prev => ({ ...prev, results: [], loading: false, error: '' }));
      }
    }, 500);

    return () => clearTimeout(timerId);
  }, [iTunesSearch.keyword, executeITunesSearch]);


  // iTunes検索結果を選択
  const selectITunesResult = (item) => {
    if (iTunesSearch.type === 'artist') {
      setSearchParams(prev => ({ ...prev, artistName: item.name }));
      setSelectedImages(prev => ({ ...prev, artist: item.image }));
    } else {
      setSearchParams(prev => ({ ...prev, songName: item.name }));
      setSelectedImages(prev => ({ ...prev, song: item.image }));
    }
    setITunesSearch(prev => ({ ...prev, type: null }));
  };

  // 条件リセット
  const clearCondition = (type) => {
    if (type === 'artist') {
      setSearchParams(prev => ({ ...prev, artistName: '' }));
      setSelectedImages(prev => ({ ...prev, artist: null }));
    } else if (type === 'song') {
      setSearchParams(prev => ({ ...prev, songName: '' }));
      setSelectedImages(prev => ({ ...prev, song: null }));
    } else if (type === 'radioName') {
      setSearchParams(prev => ({ ...prev, radioName: '' }));
    }
  };

  // 入力ハンドラ（ラジオネーム用）
  const handleRadioNameChange = (e) => {
    setSearchParams(prev => ({ ...prev, radioName: e.target.value }));
  };

  return (
    <div className="flex flex-col h-full min-h-[80vh]">
      {/* ヘッダー＆ナビゲーション */}
      <div className="flex items-center justify-between mb-6">
        <Button onClick={onBackToDashboard} variant="secondary" size="sm" className="bg-white border border-slate-200 text-slate-500">
          <ArrowLeft size={16} /> ダッシュボードへ
        </Button>
        <div className="text-slate-400 font-bold text-sm">連投履歴検索</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* 左側：検索条件パネル */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Filter className="text-blue-500" />
                絞り込み条件
              </h3>
              <div className="flex items-center gap-2">
                {isSearching && <Loader2 size={16} className="animate-spin text-slate-400" />}
              </div>
            </div>

            <div className="space-y-6">
              {/* アーティスト条件 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Artist</label>
                {searchParams.artistName ? (
                  <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex items-center gap-3">
                      {selectedImages.artist ? (
                        <img src={selectedImages.artist} className="w-10 h-10 rounded-full bg-white object-cover shadow-sm border border-white" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white text-indigo-500 flex items-center justify-center shadow-sm"><User size={20} /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-indigo-900 truncate text-sm">{searchParams.artistName}</div>
                      </div>
                      <button onClick={() => clearCondition('artist')} className="p-1.5 bg-white text-slate-400 rounded-full hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => openITunesSearch('artist')} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-1 group">
                    <Mic size={24} className="group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs">アーティストを選択</span>
                  </button>
                )}
              </div>

              {/* 曲条件 */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Song</label>
                {searchParams.songName ? (
                  <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-pink-50 border border-pink-100 p-3 rounded-2xl flex items-center gap-3">
                      {selectedImages.song ? (
                        <img src={selectedImages.song} className="w-10 h-10 rounded-lg bg-white object-cover shadow-sm border border-white" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white text-pink-500 flex items-center justify-center shadow-sm"><Music2 size={20} /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-pink-900 truncate text-sm">{searchParams.songName}</div>
                      </div>
                      <button onClick={() => clearCondition('song')} className="p-1.5 bg-white text-slate-400 rounded-full hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => openITunesSearch('song')} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-pink-400 hover:text-pink-500 hover:bg-pink-50 transition-all flex flex-col items-center justify-center gap-1 group">
                    <Disc size={24} className="group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-xs">曲を選択（任意）</span>
                  </button>
                )}
              </div>

              {/* ラジオネーム条件 & 除外トグル */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Radio Name</label>
                <div className="relative mb-3">
                  <Input
                    placeholder="部分一致で検索..."
                    value={searchParams.radioName}
                    onChange={handleRadioNameChange}
                    className="mb-0 text-sm"
                  />
                  {searchParams.radioName && (
                    <button
                      onClick={() => clearCondition('radioName')}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* まんすけ乱数除外トグル */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${searchParams.excludeMansuke ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100'}`}
                  onClick={() => setSearchParams(prev => ({ ...prev, excludeMansuke: !prev.excludeMansuke }))}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-sm font-bold ${searchParams.excludeMansuke ? 'text-blue-600' : 'text-slate-600'}`}>まんすけ乱数を除外</span>
                    <span className="text-[10px] text-slate-400">「まんすけXXX」を非表示にします</span>
                  </div>

                  <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${searchParams.excludeMansuke ? 'bg-blue-500' : 'bg-slate-200'}`}>
                    <div
                      className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${searchParams.excludeMansuke ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 font-medium">
                条件を変更すると自動的に検索されます
              </p>
            </div>
          </div>
        </div>

        {/* 右側：結果リスト */}
        <div className="w-full lg:w-2/3">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col h-[600px]">
            {/* リストヘッダー */}
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white rounded-t-3xl z-10">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Clock size={18} className="text-slate-400" />
                検索結果
              </h3>
              {hasSearched && !isSearching && (
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-500 p-1.5 rounded-full">
                    <SlidersHorizontal size={14} />
                  </span>
                  <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                    {results.length}件 (直近5000件中)
                  </span>
                </div>
              )}
            </div>

            {/* リスト本体 */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
              {!hasCondition ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                  <Search size={64} className="opacity-20" />
                  <p className="font-bold text-sm">左側のパネルで条件を指定してください</p>
                </div>
              ) : isSearching ? (
                <div className="h-full flex flex-col items-center justify-center text-blue-400 gap-4">
                  <Loader2 size={48} className="animate-spin opacity-50" />
                  <p className="font-bold text-sm">サーバーで検索中...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="bg-white p-6 rounded-full shadow-sm">
                    <AlertCircle size={40} className="text-slate-300" />
                  </div>
                  <p className="font-bold text-sm">条件に一致する履歴は見つかりませんでした</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4"
                    >
                      {/* 日時バッジ */}
                      <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-2 min-w-[60px] border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                        <span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-blue-400">
                          {item.sentAt.toLocaleDateString('ja-JP', { month: 'short' })}
                        </span>
                        <span className="text-xl font-black text-slate-700 leading-none my-0.5 group-hover:text-blue-600">
                          {item.sentAt.getDate()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">
                          {String(item.sentAt.getHours()).padStart(2, '0')}:{String(item.sentAt.getMinutes()).padStart(2, '0')}
                        </span>
                      </div>

                      {/* メイン情報 */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User size={14} className="text-indigo-400" />
                          <h4 className="font-bold text-slate-800 truncate text-lg leading-tight">
                            {item.radioName}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-pink-50 px-2 py-1 rounded-lg border border-pink-100 max-w-full">
                            <Music2 size={12} className="text-pink-500 shrink-0" />
                            <span className="text-xs font-bold text-pink-700 truncate">{item.songName}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* iTunes検索モーダル (Functions経由検索) */}
      <AnimatePresence>
        {iTunesSearch.type && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setITunesSearch(prev => ({ ...prev, type: null }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {iTunesSearch.type === 'artist' ? <Mic className="text-indigo-500" /> : <Disc className="text-pink-500" />}
                  {iTunesSearch.type === 'artist' ? 'アーティスト検索' : '曲を検索'}
                </h3>
                <button onClick={() => setITunesSearch(prev => ({ ...prev, type: null }))} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 bg-slate-50 border-b border-slate-100 relative">
                <div className="relative">
                  <Input
                    placeholder={iTunesSearch.type === 'artist' ? "例：ONE OK ROCK" : "例：Delusion:All"}
                    value={iTunesSearch.keyword}
                    onChange={(e) => setITunesSearch(prev => ({ ...prev, keyword: e.target.value }))}
                    className="mb-0 bg-white pr-10"
                    autoFocus
                  />
                  {iTunesSearch.loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  )}
                </div>
                {iTunesSearch.error && <p className="text-red-500 text-xs font-bold mt-2 ml-1">{iTunesSearch.error}</p>}
              </div>

              <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50 custom-scrollbar">
                {iTunesSearch.results.length === 0 && !iTunesSearch.loading && (
                  <div className="text-center py-12 text-slate-400">
                    <Search size={48} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">
                      {iTunesSearch.keyword ? "見つかりませんでした" : "キーワードを入力して検索してください"}
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  {iTunesSearch.results.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => selectITunesResult(item)}
                      className={`
                                flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden bg-white hover:border-blue-400 hover:shadow-md group
                                ${iTunesSearch.type === 'artist' ? 'border-indigo-100' : 'border-pink-100'}
                            `}
                    >
                      <img
                        src={item.image}
                        alt=""
                        className={`w-16 h-16 object-cover bg-slate-200 shadow-sm shrink-0 group-hover:scale-105 transition-transform ${iTunesSearch.type === 'artist' ? 'rounded-full' : 'rounded-lg'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-lg truncate group-hover:text-blue-600 transition-colors">{item.name}</div>
                        <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-0.5">
                          {iTunesSearch.type === 'song' ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Mic size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate">{item.artist}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Disc size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate">{item.album}</span>
                              </div>
                            </>
                          ) : (
                            <span className="text-indigo-400 font-medium">{item.genre}</span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 mr-2">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// アイコンヘルパー (変更なし)
const SendIcon = ({ size }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
  >
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export default SearchScreen;