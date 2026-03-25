import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { man02Db, callFunction } from '../firebase';
import {
    Users, MapPin, Settings, Plus, Trash2, Eye,
    Battery, Clock, Navigation, Crosshair, Gauge,
    ArrowLeft, X
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Google Maps スクリプトロード
const loadGoogleMaps = () => {
    return new Promise((resolve, reject) => {
        if (window.google?.maps) { resolve(window.google.maps); return; }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google.maps);
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// 住所を逆ジオコーディング
const reverseGeocode = async (lat, lng) => {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=ja`
        );
        const data = await res.json();
        if (data.results?.length > 0) {
            return data.results[0].formatted_address.replace(/^日本、〒\d{3}-\d{4}\s*/, '');
        }
        return '住所を特定できません';
    } catch { return '住所取得エラー'; }
};

// 日時フォーマット
const formatDate = (timestamp) => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    let relative;
    if (minutes < 1) relative = 'たった今';
    else if (minutes < 60) relative = `${minutes}分前`;
    else if (hours < 24) relative = `${hours}時間前`;
    else relative = `${Math.floor(hours / 24)}日前`;
    const formatted = date.toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${formatted}（${relative}）`;
};

// バッテリー色
const getBatteryColor = (battery) => {
    if (battery == null) return '#94a3b8';
    if (battery <= 20) return '#ef4444';
    if (battery <= 50) return '#f59e0b';
    return '#10b981';
};

// バッテリー範囲表示
const getBatteryRange = (battery) => {
    if (battery == null) return '--';
    return `${Math.max(0, battery - 2)}~${Math.min(100, battery + 2)}%`;
};

// ===== アクセス管理画面 =====
function AccessManagementView({ onBack }) {
    const [allowedUids, setAllowedUids] = useState([]);
    const [newUid, setNewUid] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [removingUid, setRemovingUid] = useState(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(man02Db, 'config', 'access'), (docSnap) => {
            if (docSnap.exists()) {
                setAllowedUids(docSnap.data().allowedUids || []);
            } else {
                setAllowedUids([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAdd = async () => {
        if (!newUid.trim()) return;
        setAdding(true);
        try {
            await callFunction('man02AddAllowedUid')({ uid: newUid.trim() });
            setNewUid('');
        } catch (err) {
            alert('追加に失敗しました: ' + err.message);
        }
        setAdding(false);
    };

    const handleRemove = async (uid) => {
        if (!confirm(`UID "${uid}" をホワイトリストから削除しますか？`)) return;
        setRemovingUid(uid);
        try {
            await callFunction('man02RemoveAllowedUid')({ uid });
        } catch (err) {
            alert('削除に失敗しました: ' + err.message);
        }
        setRemovingUid(null);
    };

    return (
        <div className="pm2-subview">
            <button className="pm2-back-btn" onClick={onBack}>
                <ArrowLeft size={16} /> PM2メニューに戻る
            </button>

            <div className="section-card" style={{ marginTop: 24 }}>
                <div className="section-header">
                    <Users size={18} /> ホワイトリストを管理する
                </div>
                <div className="section-body">
                    <p className="pm2-access-note">
                        <strong>isStaff</strong> が真のユーザーは、ホワイトリストに追加されていなくてもMAN02にアクセスできます。<br />
                        以下は、isStaffではないがアクセスを許可するUIDのホワイトリストです。
                    </p>

                    {/* UID追加 */}
                    <div className="pm2-uid-add">
                        <input
                            type="text"
                            className="input-field"
                            placeholder="UIDを入力..."
                            value={newUid}
                            onChange={(e) => setNewUid(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding || !newUid.trim()}>
                            <Plus size={14} /> 追加
                        </button>
                    </div>

                    {/* UIDリスト */}
                    {loading ? (
                        <div className="pm2-loading">読み込み中...</div>
                    ) : allowedUids.length === 0 ? (
                        <div className="pm2-empty">ホワイトリストにUIDが登録されていません</div>
                    ) : (
                        <div className="pm2-uid-list">
                            {allowedUids.map(uid => (
                                <div key={uid} className="pm2-uid-item">
                                    <span className="pm2-uid-text">{uid}</span>
                                    <button
                                        className="pm2-uid-remove"
                                        onClick={() => handleRemove(uid)}
                                        disabled={removingUid === uid}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== 小さい地図モーダル =====
function MiniMap({ lat, lng, label, timestamp, mapsLoaded }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (!mapsLoaded || !mapRef.current || lat == null || lng == null) return;
        const pos = { lat, lng };
        if (!mapInstance.current) {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: pos,
                zoom: 16,
                disableDefaultUI: true,
                draggable: false,
                zoomControl: false,
                scrollwheel: false,
                gestureHandling: 'none',
                styles: [
                    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
                    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                ]
            });
            markerRef.current = new window.google.maps.Marker({
                position: pos,
                map: mapInstance.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
            });
        } else {
            mapInstance.current.setCenter(pos);
            markerRef.current.setPosition(pos);
        }
    }, [mapsLoaded, lat, lng]);

    return (
        <div className="pm2-mini-map-container">
            <div className="pm2-mini-map-label">{label}</div>
            <div ref={mapRef} className="pm2-mini-map" />
            <div className="pm2-mini-map-time">{formatDate(timestamp)}</div>
        </div>
    );
}

// ===== 公開情報 全画面モーダル =====
function PublicInfoFullscreen({ onClose }) {
    const [locationData, setLocationData] = useState(null);
    const [mapsLoaded, setMapsLoaded] = useState(false);
    const [isSpoofing, setIsSpoofing] = useState(false);
    const [spoofingToggling, setSpoofingToggling] = useState(false);
    const [isSharing, setIsSharing] = useState(true);
    const [sharingToggling, setSharingToggling] = useState(false);
    const [realAddress, setRealAddress] = useState('--');
    const [displayAddress, setDisplayAddress] = useState('--');
    const [speed, setSpeed] = useState(5); // km/h
    const [currentTime, setCurrentTime] = useState('');
    const bigMapRef = useRef(null);
    const bigMapInstance = useRef(null);
    const spoofMarkerRef = useRef(null);
    const spoofPos = useRef({ lat: 35.6812, lng: 139.7671 }); // デフォルト：東京駅
    const animFrameRef = useRef(null);
    const keysPressed = useRef(new Set());

    // 現在日時を毎秒更新
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const y = now.getFullYear();
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            setCurrentTime(`${y}/${mo}/${d} ${h}:${mi}:${s}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // Google Maps読み込み
    useEffect(() => {
        loadGoogleMaps().then(() => setMapsLoaded(true)).catch(console.error);
    }, []);

    // Firestoreリアルタイム監視
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(man02Db, 'location', 'current'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLocationData(data);
                setIsSpoofing(data.isSpoofing || false);
                setIsSharing(data.isSharing !== false);
                if (data.isSpoofing && data.spoofedLatitude != null) {
                    spoofPos.current = { lat: data.spoofedLatitude, lng: data.spoofedLongitude };
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // 住所取得
    useEffect(() => {
        if (locationData?.latitude != null) {
            reverseGeocode(locationData.latitude, locationData.longitude).then(setRealAddress);
        }
    }, [locationData?.latitude, locationData?.longitude]);

    useEffect(() => {
        if (!locationData) return;
        if (locationData.isSpoofing && locationData.spoofedLatitude != null) {
            reverseGeocode(locationData.spoofedLatitude, locationData.spoofedLongitude).then(setDisplayAddress);
        } else if (locationData.latitude != null) {
            reverseGeocode(locationData.latitude, locationData.longitude).then(setDisplayAddress);
        }
    }, [locationData?.isSpoofing, locationData?.spoofedLatitude, locationData?.spoofedLongitude, locationData?.latitude, locationData?.longitude]);

    // 大きい地図の初期化
    useEffect(() => {
        if (!mapsLoaded || !bigMapRef.current) return;

        const initPos = locationData?.latitude != null
            ? { lat: locationData.latitude, lng: locationData.longitude }
            : { lat: 35.6812, lng: 139.7671 };

        if (!bigMapInstance.current) {
            bigMapInstance.current = new window.google.maps.Map(bigMapRef.current, {
                center: initPos,
                zoom: 16,
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                styles: [
                    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
                    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
                    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8e6c9' }] },
                ]
            });

            // 偽造マーカー
            spoofMarkerRef.current = new window.google.maps.Marker({
                position: spoofPos.current,
                map: bigMapInstance.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: '#ef4444',
                    fillOpacity: 0.9,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                },
                draggable: true,
            });

            // マーカードラッグで位置更新
            spoofMarkerRef.current.addListener('dragend', (e) => {
                spoofPos.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                if (isSpoofingRef.current) {
                    callFunction('man02UpdateSpoofedLocation')({
                        latitude: spoofPos.current.lat,
                        longitude: spoofPos.current.lng,
                    }).catch(console.error);
                }
            });

            // 地図クリックで位置設定
            bigMapInstance.current.addListener('click', (e) => {
                spoofPos.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                spoofMarkerRef.current.setPosition(spoofPos.current);
                if (isSpoofingRef.current) {
                    callFunction('man02UpdateSpoofedLocation')({
                        latitude: spoofPos.current.lat,
                        longitude: spoofPos.current.lng,
                    }).catch(console.error);
                }
            });
        }
    }, [mapsLoaded]);

    // isSpoofing状態の更新を反映
    const isSpoofingRef = useRef(isSpoofing);
    useEffect(() => {
        isSpoofingRef.current = isSpoofing;
    }, [isSpoofing]);

    // キーボード制御（WASD / 矢印キー）
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                keysPressed.current.add(e.key);
            }
        };
        const handleKeyUp = (e) => {
            keysPressed.current.delete(e.key);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [onClose]);

    // 速度参照（refで最新値を追跡）
    const speedRef = useRef(speed);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    // アニメーションフレームで位置を更新
    useEffect(() => {
        let lastTime = performance.now();
        const updateThrottle = 500;
        let lastFirestoreUpdate = 0;

        const animate = (currentTime) => {
            const delta = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            const keys = keysPressed.current;
            if (keys.size > 0 && spoofMarkerRef.current) {
                const speedMs = (speedRef.current * 1000) / 3600;
                const distance = speedMs * delta;
                const latDeg = distance / 111000;
                const lngDeg = distance / (111000 * Math.cos(spoofPos.current.lat * Math.PI / 180));

                let dLat = 0, dLng = 0;
                if (keys.has('w') || keys.has('ArrowUp')) dLat += latDeg;
                if (keys.has('s') || keys.has('ArrowDown')) dLat -= latDeg;
                if (keys.has('a') || keys.has('ArrowLeft')) dLng -= lngDeg;
                if (keys.has('d') || keys.has('ArrowRight')) dLng += lngDeg;

                if (dLat !== 0 || dLng !== 0) {
                    spoofPos.current = {
                        lat: spoofPos.current.lat + dLat,
                        lng: spoofPos.current.lng + dLng,
                    };
                    spoofMarkerRef.current.setPosition(spoofPos.current);
                    bigMapInstance.current?.panTo(spoofPos.current);

                    if (isSpoofingRef.current && currentTime - lastFirestoreUpdate > updateThrottle) {
                        lastFirestoreUpdate = currentTime;
                        callFunction('man02UpdateSpoofedLocation')({
                            latitude: spoofPos.current.lat,
                            longitude: spoofPos.current.lng,
                        }).catch(console.error);
                    }
                }
            }

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    // 偽造トグル
    const handleToggleSpoofing = async () => {
        setSpoofingToggling(true);
        try {
            const newState = !isSpoofing;
            await callFunction('man02ToggleSpoofing')({
                isSpoofing: newState,
                latitude: spoofPos.current.lat,
                longitude: spoofPos.current.lng,
            });
        } catch (err) {
            alert('偽造の切り替えに失敗: ' + err.message);
        }
        setSpoofingToggling(false);
    };

    // 共有トグル
    const handleToggleSharing = async () => {
        setSharingToggling(true);
        try {
            const newState = !isSharing;
            await callFunction('man02ToggleSharing')({ isSharing: newState });
        } catch (err) {
            alert('共有の切り替えに失敗: ' + err.message);
        }
        setSharingToggling(false);
    };

    // MAN02で表示されている位置を計算
    const displayLat = locationData?.isSpoofing ? locationData?.spoofedLatitude : locationData?.latitude;
    const displayLng = locationData?.isSpoofing ? locationData?.spoofedLongitude : locationData?.longitude;
    const displayTimestamp = locationData?.isSpoofing ? locationData?.spoofedAt : locationData?.updatedAt;

    return (
        <div className="pm2-fullscreen-overlay">
            <div className="pm2-fullscreen-content">
                {/* ヘッダー */}
                <div className="pm2-fullscreen-header">
                    <div className="pm2-fullscreen-header-left">
                        <h2 className="pm2-fullscreen-title">公開情報の確認と編集</h2>
                        <span className="pm2-current-time">{currentTime}</span>
                    </div>
                    <button className="pm2-fullscreen-close" onClick={onClose} title="閉じる (Esc)">
                        <X size={20} />
                    </button>
                </div>

                {/* コンテンツ: 30%:70% */}
                <div className="pm2-fullscreen-body">
                    {/* 左30% */}
                    <div className="pm2-left-panel">
                        {/* 上半分: 2つのミニマップ */}
                        <div className="pm2-mini-maps">
                            <MiniMap
                                lat={locationData?.latitude}
                                lng={locationData?.longitude}
                                label="実際の位置情報"
                                timestamp={locationData?.updatedAt}
                                mapsLoaded={mapsLoaded}
                            />
                            <MiniMap
                                lat={displayLat}
                                lng={displayLng}
                                label="MAN02で表示されている位置情報"
                                timestamp={displayTimestamp}
                                mapsLoaded={mapsLoaded}
                            />
                        </div>

                        {/* 下半分: コントロールパネル */}
                        <div className="pm2-control-panel">
                            <h3 className="pm2-control-title">
                                <Settings size={16} /> コントロールパネル
                            </h3>

                            {/* 共有トグル */}
                            <div className="pm2-control-row">
                                <span className="pm2-control-label">位置情報とバッテリー残量を共有する</span>
                                <button
                                    className={`pm2-toggle ${isSharing ? 'active' : ''}`}
                                    onClick={handleToggleSharing}
                                    disabled={sharingToggling}
                                >
                                    <div className="pm2-toggle-thumb" />
                                </button>
                            </div>

                            {/* 偽造トグル */}
                            <div className="pm2-control-row">
                                <span className="pm2-control-label">位置情報の偽造を開始</span>
                                <button
                                    className={`pm2-toggle ${isSpoofing ? 'active' : ''}`}
                                    onClick={handleToggleSpoofing}
                                    disabled={spoofingToggling}
                                >
                                    <div className="pm2-toggle-thumb" />
                                </button>
                            </div>

                            {/* バッテリー */}
                            <div className="pm2-control-row">
                                <span className="pm2-control-label">
                                    <Battery size={14} style={{ color: getBatteryColor(locationData?.battery) }} /> バッテリー
                                </span>
                                <span className="pm2-control-value" style={{ color: getBatteryColor(locationData?.battery) }}>
                                    {getBatteryRange(locationData?.battery)}
                                </span>
                            </div>

                            {/* 実際の住所 */}
                            <div className="pm2-control-address">
                                <div className="pm2-control-addr-label">実際の位置情報の住所</div>
                                <div className="pm2-control-addr-value">{realAddress}</div>
                            </div>

                            {/* 表示されている住所 */}
                            <div className="pm2-control-address">
                                <div className="pm2-control-addr-label">MAN02表示の住所</div>
                                <div className="pm2-control-addr-value">{displayAddress}</div>
                            </div>
                        </div>
                    </div>

                    {/* 右70% 全面地図 */}
                    <div className="pm2-right-panel">
                        <div ref={bigMapRef} className="pm2-big-map" />

                        {/* 速度入力オーバーレイ */}
                        <div className="pm2-speed-control">
                            <Gauge size={16} />
                            <input
                                type="number"
                                className="pm2-speed-input"
                                value={speed}
                                onChange={(e) => setSpeed(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                                min="0.1"
                                step="0.5"
                            />
                            <span className="pm2-speed-unit">km/h</span>
                        </div>

                        {/* 操作ヒント */}
                        <div className="pm2-controls-hint">
                            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 矢印キー で移動 · クリックで位置設定 · マーカーをドラッグ · <kbd>Esc</kbd> 閉じる
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== PM2 メインページ =====
export default function Pm2Page() {
    const [view, setView] = useState('menu'); // 'menu' | 'access' | 'public'
    const [currentTime, setCurrentTime] = useState('');

    // 現在日時を毎秒更新
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const y = now.getFullYear();
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            setCurrentTime(`${y}/${mo}/${d} ${h}:${mi}:${s}`);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // メニュー表示
    if (view === 'menu') {
        return (
            <div className="pm2-page">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <h1 className="page-title">PM2</h1>
                        <span className="pm2-current-time">{currentTime}</span>
                    </div>
                    <p className="page-subtitle">MANSUKE MAN02 管理コンソール</p>
                </div>

                <div className="pm2-menu-buttons">
                    <button className="pm2-menu-card" onClick={() => setView('access')}>
                        <div className="pm2-menu-card-icon">
                            <Users size={28} strokeWidth={1.5} />
                        </div>
                        <div className="pm2-menu-card-body">
                            <h3>ホワイトリストを管理する</h3>
                            <p>MAN02にアクセスできるMANSUKEアカウントのUIDを管理します</p>
                        </div>
                    </button>

                    <button className="pm2-menu-card" onClick={() => setView('public')}>
                        <div className="pm2-menu-card-icon" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
                            <Eye size={28} strokeWidth={1.5} />
                        </div>
                        <div className="pm2-menu-card-body">
                            <h3>公開情報の確認と編集</h3>
                            <p>位置情報の確認、偽造制御、バッテリー情報の表示</p>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    // ホワイトリスト管理
    if (view === 'access') {
        return (
            <div className="pm2-page">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <h1 className="page-title">PM2</h1>
                        <span className="pm2-current-time">{currentTime}</span>
                    </div>
                    <p className="page-subtitle">MANSUKE MAN02 管理コンソール</p>
                </div>
                <AccessManagementView onBack={() => setView('menu')} />
            </div>
        );
    }

    // 公開情報（全画面モーダル）
    if (view === 'public') {
        return <PublicInfoFullscreen onClose={() => setView('menu')} />;
    }

    return null;
}
