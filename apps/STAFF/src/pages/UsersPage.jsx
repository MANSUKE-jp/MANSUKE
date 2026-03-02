import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users as UsersIcon, Loader2 } from 'lucide-react';
import { callFunction } from '../firebase';

const UsersPage = () => {
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
            const fn = callFunction('staffSearchUsers');
            const result = await fn({ query: searchQuery.trim() });
            setResults(result.data.users || []);
        } catch (err) {
            setError(err.message || '検索に失敗しました。');
            setResults([]);
        } finally { setLoading(false); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">ユーザー検索</h1>
                <p className="page-subtitle">氏名、メールアドレス、電話番号、UID で部分一致検索できます</p>
            </div>

            <div className="search-bar">
                <input
                    className="input-field"
                    placeholder="名前、メール、電話番号、UID を入力..."
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
                    {results.map(user => (
                        <div key={user.uid} className="result-item" onClick={() => navigate(`/users/${user.uid}`)}>
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: 16,
                            }}>
                                {(user.lastName || user.firstName || user.email || '?')[0].toUpperCase()}
                            </div>
                            <div className="result-item-body">
                                <div className="result-item-title">
                                    {user.lastName} {user.firstName}
                                    {user.nickname && <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>({user.nickname})</span>}
                                </div>
                                <div className="result-item-subtitle">
                                    {user.email} · {user.phone || '電話未登録'} · UID: {user.uid?.substring(0, 12)}...
                                </div>
                            </div>
                            <div className="result-item-badge">
                                <span className={`badge ${user.isStaff ? 'badge-active' : 'badge-inactive'}`}>
                                    {user.isStaff ? 'Staff' : 'User'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : searched ? (
                <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <div className="empty-state-text">該当するユーザーが見つかりませんでした</div>
                </div>
            ) : null}
        </div>
    );
};

export default UsersPage;
