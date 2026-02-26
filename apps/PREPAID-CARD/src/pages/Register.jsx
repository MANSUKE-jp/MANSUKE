import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ArrowRight, CheckCircle, AlertCircle, Database, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { parseCSV, uploadPrepaidCards } from '../logic/csvService';
import { Link } from 'react-router-dom';

const Register = () => {
    const [step, setStep] = useState(1); // 1:Upload, 2:Mapping, 3:Uploading, 4:Finish
    const [file, setFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ publicCode: '', pinCode: '' });
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // ファイル選択ハンドラ
    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = async (selectedFile) => {
        setFile(selectedFile);
        setError('');
        try {
            const { data, headers } = await parseCSV(selectedFile);
            if (data.length === 0) {
                throw new Error('データが含まれていません。');
            }
            setCsvData(data);
            setHeaders(headers);
            setStep(2);

            // 自動推定
            const publicGuess = headers.find(h => h.toLowerCase().includes('public') || h.toLowerCase().includes('code') || h.toLowerCase().includes('id'));
            const pinGuess = headers.find(h => h.toLowerCase().includes('pin') || h.toLowerCase().includes('pass'));
            setMapping({
                publicCode: publicGuess || headers[0],
                pinCode: pinGuess || headers[1] || headers[0]
            });

        } catch (err) {
            setError('CSVの読み込みに失敗しました。フォーマットを確認してください。');
        }
    };

    // ドラッグ＆ドロップ
    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === "text/csv") {
            processFile(droppedFile);
        } else {
            setError("CSVファイルのみ対応しています。");
        }
    };

    // アップロード実行
    const handleUpload = async () => {
        setStep(3);
        try {
            await uploadPrepaidCards(csvData, mapping, (percent) => {
                setProgress(percent);
            });
            setTimeout(() => setStep(4), 1000);
        } catch (err) {
            setError('データベースへの保存中にエラーが発生しました。');
            setStep(2);
        }
    };

    // コンポーネント: ファイルアップロード
    const UploadView = () => (
        <div
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-3xl bg-white/5 hover:bg-white/10 hover:border-[#d5b263] transition-all duration-300 group cursor-pointer md:cursor-none p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
        >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" hidden />
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Upload size={32} className="text-gray-400 group-hover:text-[#d5b263] transition-colors md:w-10 md:h-10" />
            </div>
            <h2 className="text-xl md:text-3xl font-display font-bold uppercase mb-2 text-white text-center">CSVアップロード</h2>
            <p className="text-gray-400 font-mono text-xs md:text-sm tracking-wider text-center">ドラッグ＆ドロップ または クリック</p>
            {error && <p className="mt-4 text-red-500 font-bold flex items-center gap-2 text-sm"><AlertCircle size={16} /> {error}</p>}
        </div>
    );

    // コンポーネント: マッピング設定
    const MappingView = () => (
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex items-center gap-4 mb-4 md:mb-8 shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[#d5b263] text-black rounded-full flex items-center justify-center font-bold font-display text-lg md:text-xl">02</div>
                <div>
                    <h2 className="text-xl md:text-2xl font-display font-bold uppercase text-white">データ割り当て</h2>
                    <p className="text-gray-400 text-[10px] md:text-xs font-mono">CSVの列をシステム項目に割り当ててください</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-4 md:mb-8 shrink-0">
                {/* Public Code Setting */}
                <div className="bg-white/5 p-4 md:p-6 rounded-2xl border border-white/10 hover:border-[#d5b263]/50 transition-colors">
                    <label className="block text-[#d5b263] font-bold font-display tracking-widest uppercase mb-2 md:mb-4 text-sm md:text-base">公開コードの列</label>
                    <select
                        value={mapping.publicCode}
                        onChange={(e) => setMapping({ ...mapping, publicCode: e.target.value })}
                        className="w-full bg-black border border-white/20 rounded-xl p-3 md:p-4 text-white font-mono focus:border-[#d5b263] focus:outline-none hover-trigger cursor-pointer text-sm md:text-base"
                    >
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <p className="mt-2 md:mt-4 text-[10px] md:text-xs text-gray-500">カードの識別に使用する「公開コード」の列を選択してください。</p>
                </div>

                {/* PIN Code Setting */}
                <div className="bg-white/5 p-4 md:p-6 rounded-2xl border border-white/10 hover:border-[#d5b263]/50 transition-colors">
                    <label className="block text-[#ccff00] font-bold font-display tracking-widest uppercase mb-2 md:mb-4 text-sm md:text-base">PINコードの列</label>
                    <select
                        value={mapping.pinCode}
                        onChange={(e) => setMapping({ ...mapping, pinCode: e.target.value })}
                        className="w-full bg-black border border-white/20 rounded-xl p-3 md:p-4 text-white font-mono focus:border-[#ccff00] focus:outline-none hover-trigger cursor-pointer text-sm md:text-base"
                    >
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <p className="mt-2 md:mt-4 text-[10px] md:text-xs text-gray-500">ユーザーに隠蔽される「PINコード」の列を選択してください。</p>
                </div>
            </div>

            {/* Preview Table */}
            <div className="mb-4 md:mb-8 overflow-hidden rounded-xl border border-white/10 flex-1 min-h-[100px] flex flex-col">
                <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2 shrink-0">
                    <FileSpreadsheet size={16} className="text-gray-400" />
                    <span className="text-xs font-mono text-gray-400 uppercase">プレビュー (最初の3行)</span>
                </div>
                <div className="overflow-x-auto flex-1 scrollbar-hide">
                    <table className="w-full text-left text-sm font-mono whitespace-nowrap">
                        <thead className="bg-white/5 text-gray-400">
                            <tr>
                                {headers.map(h => (
                                    <th key={h} className={`p-3 font-normal ${h === mapping.publicCode ? 'text-[#d5b263]' : h === mapping.pinCode ? 'text-[#ccff00]' : ''}`}>
                                        {h} {h === mapping.publicCode && '(公開)'} {h === mapping.pinCode && '(PIN)'}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {csvData.slice(0, 3).map((row, i) => (
                                <tr key={i} className="hover:bg-white/5">
                                    {headers.map(h => <td key={h} className="p-3 text-gray-300">{row[h]}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end gap-2 md:gap-4 shrink-0 pb-4 md:pb-0">
                <button onClick={() => setStep(1)} className="px-6 md:px-8 py-3 md:py-4 font-display font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors hover-trigger text-sm md:text-base">戻る</button>
                <button
                    onClick={handleUpload}
                    className="bg-[#d5b263] text-black px-6 md:px-8 py-3 md:py-4 font-display font-bold uppercase tracking-widest rounded-full hover:bg-white transition-colors flex items-center gap-2 hover-trigger text-sm md:text-base shadow-lg shadow-[#d5b263]/20"
                >
                    登録を開始する <Database size={18} />
                </button>
            </div>
        </div>
    );

    // コンポーネント: アップロード中
    const ProcessingView = () => (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center p-4">
            <h2 className="text-4xl md:text-6xl font-display font-bold uppercase mb-8 animate-pulse text-white">Processing</h2>

            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4 relative">
                <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-[#ccff00]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                />
            </div>

            <div className="flex justify-between w-full font-mono text-sm">
                <span className="text-gray-400">データベースへ登録中...</span>
                <span className="text-[#d5b263] font-bold">{progress}%</span>
            </div>
        </div>
    );

    // コンポーネント: 完了
    const FinishView = () => (
        <div className="flex flex-col items-center justify-center w-full text-center p-4">
            <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="w-16 h-16 md:w-24 md:h-24 bg-[#ccff00] rounded-full flex items-center justify-center text-black mb-6 md:mb-8"
            >
                <CheckCircle size={32} className="md:w-12 md:h-12" />
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-display font-bold uppercase mb-4 text-white">完了!</h2>
            <p className="text-gray-400 mb-8 md:mb-12 max-w-md mx-auto text-sm md:text-base">
                <span className="text-white font-bold">{csvData.length}</span>件のコードがデータベースに登録されました。
            </p>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <Link to="/" className="px-8 py-3 border border-white/20 rounded-full font-display font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-colors hover-trigger flex items-center justify-center">
                    メニューに戻る
                </Link>
                <button onClick={() => { setStep(1); setFile(null); }} className="px-8 py-3 bg-[#d5b263] text-black rounded-full font-display font-bold uppercase tracking-widest hover:bg-white transition-colors hover-trigger">
                    続けて登録
                </button>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative z-10">
            <div className="flex items-center gap-4 mb-4 md:mb-8 opacity-50 shrink-0">
                <Link to="/" className="hover:text-[#d5b263] transition-colors hover-trigger font-mono text-xs tracking-widest flex items-center gap-2 text-white">
                    <ArrowLeft size={14} /> メニューに戻る
                </Link>
                <span className="text-xs text-white/50">/</span>
                <span className="font-mono text-xs tracking-widest text-[#d5b263]">新規コード登録</span>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {step === 1 && <UploadView />}
                    {step === 2 && <MappingView />}
                    {step === 3 && <ProcessingView />}
                    {step === 4 && <FinishView />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default Register;