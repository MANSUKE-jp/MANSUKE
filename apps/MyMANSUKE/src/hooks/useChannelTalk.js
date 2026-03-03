import { useEffect, useRef } from 'react';

const PLUGIN_KEY = import.meta.env.VITE_CHANNEL_TALK_PLUGIN_KEY;

export default function useChannelTalk(user, userData) {
    const isBooted = useRef(false);
    const prevUserId = useRef(null);

    useEffect(() => {
        const key = PLUGIN_KEY || '7820ea9a-9bd4-4508-a941-039727e3fd84';

        if (!user) {
            if (isBooted.current) {
                window.ChannelIO?.('shutdown');
                isBooted.current = false;
                prevUserId.current = null;
            }
            // If we want guest functionality, we'd boot here without memberId, but currently
            // MANSUKE requires user login for this hook.
            return;
        }

        // If user changed, shutdown first
        if (isBooted.current && prevUserId.current !== user.uid) {
            window.ChannelIO?.('shutdown');
            isBooted.current = false;
        }

        if (userData) {
            const profile = {
                name: `${userData.lastName || ''} ${userData.firstName || ''}`.trim() || userData.nickname || userData.displayName || userData.email || user.email || '未設定',
                email: userData.email || user.email || '',
                mobileNumber: userData.phone || user.phoneNumber || '',
                balance: (userData.balance !== undefined && userData.balance !== null) ? userData.balance : 0,
                avatarUrl: userData.avatarUrl || user.photoURL || '',
                kycStatus: userData.kycStatus || '未完了'
            };

            if (!isBooted.current) {
                // Boot ChannelTalk with user info
                window.ChannelIO?.('boot', {
                    pluginKey: key,
                    memberId: user.uid,
                    profile
                });
                isBooted.current = true;
                prevUserId.current = user.uid;
            } else {
                // Update profile info for already booted session
                window.ChannelIO?.('updateUser', {
                    profile
                });
            }
        }
    }, [user, userData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.ChannelIO?.('shutdown');
        };
    }, []);
}
