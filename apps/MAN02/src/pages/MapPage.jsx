import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MapPin, Battery, Clock, Navigation, LogOut } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Google Maps スクリプトのロード
const loadGoogleMaps = () => {
    return new Promise((resolve, reject) => {
        if (window.google?.maps) {
            resolve(window.google.maps);
            return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google.maps);
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// 住所を逆ジオコーディングで取得
const reverseGeocode = async (lat, lng) => {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=ja`
        );
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].formatted_address.replace(/^日本、〒\d{3}-\d{4}\s*/, '');
        }
        return '住所を特定できません';
    } catch {
        return '住所取得エラー';
    }
};

// バッテリー残量を範囲表示
const getBatteryRange = (battery) => {
    if (battery == null) return '--';
    const low = Math.max(0, battery - 2);
    const high = Math.min(100, battery + 2);
    return `${low}~${high}%`;
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

// バッテリーアイコン色
const getBatteryColor = (battery) => {
    if (battery == null) return '#94a3b8';
    if (battery <= 20) return '#ef4444';
    if (battery <= 50) return '#f59e0b';
    return '#10b981';
};

export default function MapPage({ user, mansukeUser, onLogout }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const [locationData, setLocationData] = useState(null);
    const [address, setAddress] = useState('位置情報を取得中...');
    const [mapsLoaded, setMapsLoaded] = useState(false);
    const [infoExpanded, setInfoExpanded] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [userChipOpen, setUserChipOpen] = useState(false);

    // Firestoreからリアルタイムで位置情報を取得
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'location', 'current'), (docSnap) => {
            if (docSnap.exists()) {
                setLocationData(docSnap.data());
            }
        });
        return () => unsubscribe();
    }, []);

    // Google Maps初期化
    useEffect(() => {
        loadGoogleMaps().then(() => {
            setMapsLoaded(true);
        }).catch(err => {
            console.error('Google Maps読み込みエラー:', err);
        });
    }, []);

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

    // 表示する位置情報を決定（偽造モード対応）
    const getDisplayLocation = useCallback(() => {
        if (!locationData) return null;
        if (locationData.isSpoofing && locationData.spoofedLatitude != null && locationData.spoofedLongitude != null) {
            return {
                lat: locationData.spoofedLatitude,
                lng: locationData.spoofedLongitude,
            };
        }
        return {
            lat: locationData.latitude,
            lng: locationData.longitude,
        };
    }, [locationData]);

    // 地図の更新
    useEffect(() => {
        if (!mapsLoaded || !mapRef.current) return;

        const displayLoc = getDisplayLocation();
        if (!displayLoc) return;

        const pos = { lat: displayLoc.lat, lng: displayLoc.lng };

        if (!mapInstance.current) {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: pos,
                zoom: 15, // 約500m半径
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                styles: [
                    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                    { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
                    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
                    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
                    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
                    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
                    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8e6c9' }] },
                ]
            });

            markerRef.current = new window.google.maps.Marker({
                position: pos,
                map: mapInstance.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                },
            });

            circleRef.current = new window.google.maps.Circle({
                map: mapInstance.current,
                center: pos,
                radius: 500,
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.3,
                strokeWeight: 1,
            });
        } else {
            markerRef.current.setPosition(pos);
            circleRef.current.setCenter(pos);
            // 初回以外はユーザーが地図を動かしている可能性があるので自動パンしない
        }
    }, [mapsLoaded, getDisplayLocation]);

    // 住所取得
    useEffect(() => {
        const displayLoc = getDisplayLocation();
        if (displayLoc) {
            reverseGeocode(displayLoc.lat, displayLoc.lng).then(setAddress);
        }
    }, [getDisplayLocation]);

    // 位置情報の中心に戻す
    const recenterMap = () => {
        const displayLoc = getDisplayLocation();
        if (displayLoc && mapInstance.current) {
            mapInstance.current.panTo({ lat: displayLoc.lat, lng: displayLoc.lng });
            mapInstance.current.setZoom(15);
        }
    };

    const displayName = mansukeUser
        ? `${mansukeUser.lastName || ''} ${mansukeUser.firstName || ''}`.trim() || mansukeUser.nickname || 'User'
        : 'User';

    // isSharing判定 — falseの場合は位置情報を表示しない
    const isSharing = locationData?.isSharing !== false;

    return (
        <div className="man02-app">
            {/* ヘッダー */}
            <header className="man02-header">
                <div className="man02-header-left">
                    <span className="man02-logo">MANSUKE</span>
                    <span className="man02-logo-sub">MAN02</span>
                </div>
                <div className="man02-header-right">
                    <span className="man02-current-time">{currentTime}</span>
                </div>
            </header>

            {/* 地図 */}
            <div className="man02-map-container" style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                    ref={mapRef} 
                    className="man02-map"
                    style={{ flex: 1, display: (locationData && isSharing) ? 'block' : 'none' }} 
                />

                {/* 共有がオフの場合 */}
                {locationData && !isSharing && (
                    <div className="man02-no-data-full">
                        <MapPin size={48} strokeWidth={1.5} />
                        <h2>位置情報が届いていません</h2>
                        <p>位置情報がMANSUKEのサーバーに届いていません。</p>
                    </div>
                )}

                {/* 位置情報が無い場合のプレースホルダー */}
                {!locationData && (
                    <div className="man02-no-data-full">
                        <MapPin size={48} strokeWidth={1.5} />
                        <h2>位置情報がありません</h2>
                        <p>iOSアプリからの位置情報送信を待っています...</p>
                    </div>
                )}

                {/* 中心に戻すボタン */}
                {locationData && isSharing && (
                    <button className="man02-recenter-btn" onClick={recenterMap} title="位置情報の中心に戻す">
                        <Navigation size={18} />
                    </button>
                )}
            </div>

            {/* 情報パネル（角丸モーダル） — 共有がオンの時のみ */}
            {locationData && isSharing && (
                <div className={`man02-info-panel ${infoExpanded ? 'expanded' : 'collapsed'}`}>
                    <button className="man02-info-toggle" onClick={() => setInfoExpanded(!infoExpanded)}>
                        <div className="man02-info-handle" />
                    </button>

                    {infoExpanded && (
                        <div className="man02-info-content">
                            {/* 位置情報 */}
                            <div className="man02-info-section">
                                <div className="man02-info-section-title">
                                    <MapPin size={16} /> 位置情報
                                </div>
                                <div className="man02-info-address">{address}</div>
                                <div className="man02-info-coords">
                                    {(() => {
                                        const loc = getDisplayLocation();
                                        return loc ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}` : '--';
                                    })()}
                                </div>
                            </div>

                            {/* バッテリー */}
                            <div className="man02-info-section">
                                <div className="man02-info-section-title">
                                    <Battery size={16} style={{ color: getBatteryColor(locationData.battery) }} /> バッテリー残量
                                </div>
                                <div className="man02-info-battery">
                                    <div
                                        className="man02-battery-bar"
                                        style={{
                                            width: `${locationData.battery ?? 0}%`,
                                            background: getBatteryColor(locationData.battery),
                                        }}
                                    />
                                </div>
                                <div className="man02-info-battery-text" style={{ color: getBatteryColor(locationData.battery) }}>
                                    {getBatteryRange(locationData.battery)}
                                </div>
                            </div>

                            {/* 最終更新日時 */}
                            <div className="man02-info-section">
                                <div className="man02-info-section-title">
                                    <Clock size={16} /> 最終更新
                                </div>
                                <div className="man02-info-time">
                                    {formatDate(locationData.updatedAt)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 左下ユーザーチップ */}
            <div className="man02-user-chip-container">
                <button className="man02-user-chip" onClick={() => setUserChipOpen(!userChipOpen)}>
                    <div className="man02-user-chip-avatar">
                        {mansukeUser?.avatarUrl
                            ? <img src={mansukeUser.avatarUrl} alt="" />
                            : displayName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="man02-user-chip-info">
                        <div className="man02-user-chip-name-row">
                            <span className="man02-user-chip-name">{displayName}</span>
                        </div>
                        <div className="man02-user-chip-subtitle">
                            {mansukeUser?.isStaff ? 'STAFF' : 'USER'}
                        </div>
                    </div>
                </button>
                {userChipOpen && (
                    <div className="man02-user-chip-popup">
                        <div className="man02-user-chip-popup-header">
                            <div className="man02-user-chip-popup-name">{displayName}</div>
                            <div className="man02-user-chip-popup-email">{mansukeUser?.email || ''}</div>
                        </div>
                        <button className="man02-user-chip-action danger" onClick={onLogout}>
                            <LogOut size={16} /> サインアウト
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
