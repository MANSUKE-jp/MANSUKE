import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Database, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { parseCSV, uploadPrepaidCards } from '../logic/csvService';

const CsvPage = () => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [csvData, setCsvData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({ publicCode: '', pinCode: '' });
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const processFile = async (selectedFile) => {
        setFile(selectedFile); setError('');
        try {
            const { data, headers } = await parseCSV(selectedFile);
            if (data.length === 0) throw new Error('データが含まれていません。');
            setCsvData(data); setHeaders(headers); setStep(2);
            const publicGuess = headers.find(h => h.toLowerCase().includes('public') || h.toLowerCase().includes('code') || h.toLowerCase().includes('id'));
            const pinGuess = headers.find(h => h.toLowerCase().includes('pin') || h.toLowerCase().includes('pass'));
            setMapping({ publicCode: publicGuess || headers[0], pinCode: pinGuess || headers[1] || headers[0] });
        } catch { setError('CSVの読み込みに失敗しました。フォーマットを確認してください。'); }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f && f.type === "text/csv") processFile(f);
        else setError("CSVファイルのみ対応しています。");
    };

    const handleUpload = async () => {
        setStep(3);
        try {
            await uploadPrepaidCards(csvData, mapping, (p) => setProgress(p));
            setTimeout(() => setStep(4), 1000);
        } catch { setError('データベースへの保存中にエラーが発生しました。'); setStep(2); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">CSVファイル登録</h1>
                <p className="page-subtitle">CSVファイルからプリペイドカードコードを一括登録します</p>
            </div>

            <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>

                    {step === 1 && (
                        <div className="section-card" onClick={() => fileInputRef.current.click()}
                            onDragOver={e => e.preventDefault()} onDrop={handleDrop}
                            style={{ cursor: 'pointer', textAlign: 'center', padding: '80px 32px', borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--border-2)' }}>
                            <input type="file" ref={fileInputRef} onChange={e => e.target.files[0] && processFile(e.target.files[0])} accept=".csv" hidden />
                            <Upload size={48} style={{ color: 'var(--text-3)', marginBottom: 24 }} />
                            <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--lg)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, color: 'var(--ink)' }}>CSVアップロード</h2>
                            <p style={{ color: 'var(--text-3)', fontSize: 'var(--sm)' }}>ドラッグ＆ドロップ または クリック</p>
                            {error && <p style={{ marginTop: 16, color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><AlertCircle size={16} /> {error}</p>}
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                                <div className="section-card" style={{ padding: 24 }}>
                                    <label className="input-label" style={{ color: 'var(--gold)', marginBottom: 12, display: 'block' }}>公開コードの列</label>
                                    <select value={mapping.publicCode} onChange={e => setMapping({ ...mapping, publicCode: e.target.value })} className="input-field">
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                                <div className="section-card" style={{ padding: 24 }}>
                                    <label className="input-label" style={{ color: 'var(--green)', marginBottom: 12, display: 'block' }}>PINコードの列</label>
                                    <select value={mapping.pinCode} onChange={e => setMapping({ ...mapping, pinCode: e.target.value })} className="input-field">
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="section-card" style={{ marginBottom: 24 }}>
                                <div className="section-header"><FileSpreadsheet size={16} /> プレビュー (最初の3行)</div>
                                <div className="section-body" style={{ overflowX: 'auto', padding: 0 }}>
                                    <table style={{ width: '100%', textAlign: 'left', fontSize: 'var(--sm)', borderCollapse: 'collapse' }}>
                                        <thead><tr>
                                            {headers.map(h => (
                                                <th key={h} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: h === mapping.publicCode ? 'var(--gold)' : h === mapping.pinCode ? 'var(--green)' : 'var(--text-3)' }}>
                                                    {h} {h === mapping.publicCode && '(公開)'} {h === mapping.pinCode && '(PIN)'}
                                                </th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {csvData.slice(0, 3).map((row, i) => (
                                                <tr key={i}>{headers.map(h => <td key={h} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{row[h]}</td>)}</tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
                                <button className="btn btn-ghost" onClick={() => setStep(1)}>戻る</button>
                                <button className="btn btn-gold" onClick={handleUpload}>
                                    <Database size={16} /> 登録を開始する
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
                            <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--xl)', fontWeight: 700, marginBottom: 32, color: 'var(--ink)' }}>PROCESSING</h2>
                            <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
                                <motion.div style={{ height: '100%', background: 'var(--grad)', borderRadius: 99 }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--sm)' }}>
                                <span style={{ color: 'var(--text-3)' }}>データベースへ登録中...</span>
                                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{progress}%</span>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 80, height: 80, background: 'var(--green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <CheckCircle size={40} color="#fff" />
                            </motion.div>
                            <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--xl)', fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>完了!</h2>
                            <p style={{ color: 'var(--text-2)', marginBottom: 32 }}>
                                <strong>{csvData.length}</strong> 件のコードがデータベースに登録されました。
                            </p>
                            <button className="btn btn-gold" onClick={() => { setStep(1); setFile(null); setCsvData([]); setHeaders([]); }}>
                                続けて登録
                            </button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default CsvPage;
