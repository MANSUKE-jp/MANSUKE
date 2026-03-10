import React from 'react';
import { ROLE_DEFINITIONS } from '../../constants/gameData';
import { Settings, Users, PieChart } from 'lucide-react';

// ゲーム中の役職内訳確認用パネルコンポーネント
// 現在の設定でどの役職が何人いるか一覧表示する
export const RoleDistributionPanel = ({ roleSettings }) => {
    // 全役職の合計人数計算
    // roleSettingsがnull/undefinedの場合の安全策として空オブジェクト指定
    const total = Object.values(roleSettings || {}).reduce((a, b) => a + b, 0);

    // 設定数が1以上の役職のみ抽出
    // [key, count]の形式で配列化
    const validRoles = Object.entries(roleSettings || {}).filter(([, c]) => c > 0);

    // 陣営ごとのグルーピング用コンテナ初期化
    // 役職定義(ROLE_DEFINITIONS)のteamプロパティに基づいて振り分ける
    const groups = {
        citizen: [],
        werewolf: [],
        third: []
    };

    // 抽出した有効役職をループ処理して振り分け
    validRoles.forEach(([roleKey, count]) => {
        const def = ROLE_DEFINITIONS[roleKey];
        // 定義が存在し、かつ対応するチーム配列がある場合のみ追加
        if (def && groups[def.team]) {
            groups[def.team].push({ key: roleKey, count, def });
        }
    });

    // 表示セクションの定義
    // 各陣営のラベル、テーマカラー、背景色などを設定
    const sections = [
        { key: 'werewolf', label: '人狼陣営', color: 'text-red-300', bg: 'bg-red-900/30', border: 'border-red-500/40' },
        { key: 'citizen', label: '市民陣営', color: 'text-blue-400', bg: 'bg-red-900/30', border: 'border-red-500/30' },
        { key: 'third', label: '第三陣営', color: 'text-amber-300', bg: 'bg-amber-900/30', border: 'border-amber-500/40' },
    ];

    return (
        <div className="flex flex-col h-full max-h-[70vh] lg:max-h-full bg-gray-800/80 backdrop-blur border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
            {/* ヘッダーエリア */}
            <div className="p-3 border-b border-gray-700 bg-gray-950 flex items-center justify-between shrink-0">
                <span className="font-bold text-gray-100 flex items-center gap-2 text-sm truncate">
                    <PieChart size={16} className="text-red-400 shrink-0" /> 配役内訳
                </span>
                
                {/* 人数情報 */}
                <div className="flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 px-2.5 py-1 rounded text-[10px] md:text-xs">
                    <Users size={12} className="text-gray-300 shrink-0" />
                    <span className="font-mono font-bold text-gray-300">{total}名設定</span>
                </div>
            </div>

            {/* スクロール可能なリストエリア */}
            <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar space-y-3 md:space-y-4">
                {sections.map(section => {
                    const rolesInGroup = groups[section.key];
                    // 該当陣営に役職が一つもない場合は表示しない
                    if (rolesInGroup.length === 0) return null;

                    return (
                        <div key={section.key} className={`rounded-xl overflow-hidden border ${section.border}`}>
                            {/* 陣営ヘッダー */}
                            <div className={`px-3 py-1.5 text-xs font-bold ${section.bg} ${section.color} flex justify-between items-center`}>
                                <span>{section.label}</span>
                                {/* 陣営内合計人数 */}
                                <span className="bg-gray-800/50 border border-current px-1.5 rounded text-[10px]">合計: {rolesInGroup.reduce((a, b) => a + b.count, 0)}</span>
                            </div>

                            {/* 役職リストグリッド */}
                            <div className="p-2 gap-2 grid grid-cols-1 bg-gray-950">
                                {rolesInGroup.map(({ key, count, def }) => (
                                    <div key={key} className="flex items-center p-2 rounded-lg border border-gray-700 bg-gray-950 shadow-sm">
                                        {/* アイコンエリア */}
                                        <div className={`p-1.5 md:p-2 rounded-full bg-gray-800/50 border border-current mr-2 md:mr-3 ${section.color} shrink-0`}>
                                            {/* Lucideアイコンを動的に生成 */}
                                            {React.createElement(def.icon, { size: 16, className: "md:w-[18px] md:h-[18px]" })}
                                        </div>

                                        {/* 情報エリア */}
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="flex items-baseline gap-1.5 truncate">
                                                {/* 役職名 */}
                                                <span className="font-bold text-gray-100 text-sm truncate">{def.name}</span>
                                            </div>
                                            {/* 説明文 */}
                                            <p className="text-[9px] md:text-[10px] text-gray-300 leading-tight mt-0.5 truncate">{def.desc}</p>
                                        </div>
                                        <div className="px-2.5 py-1 bg-gray-800/80 border border-gray-700 rounded uppercase text-[10px] md:text-xs font-black text-red-400 shrink-0 shadow-inner">
                                            {count}<span className="text-[10px] md:text-xs font-normal ml-0.5 opacity-80">名</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};