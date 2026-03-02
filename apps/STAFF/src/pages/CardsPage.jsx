import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CreditCard, Loader2 } from 'lucide-react';
import { callFunction } from '../firebase';

const statusMap = {
    inactive: { label: '未使用', class: 'badge-inactive' },
    active: { label: 'アクティベート済み', class: 'badge-active' },
    redeemed: { label: '使用済み', class: 'badge-redeemed' },
    disabled: { label: '無効', class: 'badge-disabled' },
};

const CardsPage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true); setError(''); setSearched(true);
        try {
            const fn = callFunction('staffSearchCards');
            const result = await fn({ query: searchQuery.trim() });
            setResults(result.data.cards || []);
        } catch (err) {
            setError(err.message || '検索に失敗しました。');
            setResults([]);
        } finally { setLoading(false); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">既存コードを管理</h1>
                <p className="page-subtitle">publicCode または pinCode で部分一致検索できます</p>
            </div>

            <div className="search-bar">
                <input
                    className="input-field"
                    placeholder="コードを入力して検索..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                    検索
                </button>
            </div>

            {error && <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 'var(--sm)' }}>{error}</div>}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 64 }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
            ) : results.length > 0 ? (
                <div className="result-list">
                    {results.map(card => {
                        const st = statusMap[card.status] || statusMap.inactive;
                        return (
                            <div key={card.id} className="result-item" onClick={() => navigate(`/cards/${card.id}`)}>
                                <CreditCard size={20} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                                <div className="result-item-body">
                                    <div className="result-item-title" style={{ fontFamily: 'monospace' }}>{card.publicCode}</div>
                                    <div className="result-item-subtitle">PIN: {card.pinCode} · 金額: ¥{(card.amount || 0).toLocaleString()}</div>
                                </div>
                                <div className="result-item-badge">
                                    <span className={`badge ${st.class}`}>{st.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : searched ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-text">該当するカードが見つかりませんでした</div>
                </div>
            ) : null}
        </div>
    );
};

export default CardsPage;
