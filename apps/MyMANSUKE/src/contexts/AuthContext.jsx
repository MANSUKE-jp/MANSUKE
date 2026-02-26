import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);  // Firebase Auth user
    const [userData, setUserData] = useState(null);  // Firestore user document
    const [loading, setLoading] = useState(true);
    const [passkeyVerified, setPasskeyVerifiedState] = useState(() => {
        return localStorage.getItem('mansukePasskeyVerified') === 'true';
    });

    const setPasskeyVerified = (val) => {
        if (val) localStorage.setItem('mansukePasskeyVerified', 'true');
        else localStorage.removeItem('mansukePasskeyVerified');
        setPasskeyVerifiedState(val);
    };

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (!firebaseUser) {
                setUserData(null);
                setPasskeyVerified(false);
                setLoading(false);

                // Clear the cross-subdomain cookie on logout
                // あらゆるドメインの組み合わせで削除を試みる
                const domains = [
                    '.mansuke.jp',
                    'mansuke.jp',
                    'my.mansuke.jp',
                    window.location.hostname,
                    ''
                ];
                domains.forEach(d => {
                    const domainStr = d ? `domain=${d};` : '';
                    document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
                    document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
                });
            }
        });
        return unsubAuth;
    }, []);

    // Subscribe to Firestore user document when auth user is known
    useEffect(() => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const unsubFs = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                setUserData(snap.data());
            }
            setLoading(false);
        }, () => {
            setLoading(false);
        });
        return unsubFs;
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            userData,
            loading,
            passkeyVerified,
            setPasskeyVerified,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
