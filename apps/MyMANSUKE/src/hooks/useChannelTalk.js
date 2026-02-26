import { useEffect } from 'react';

const PLUGIN_KEY = import.meta.env.VITE_CHANNEL_TALK_PLUGIN_KEY;

export default function useChannelTalk(user, userData) {
    useEffect(() => {
        const key = PLUGIN_KEY || '7820ea9a-9bd4-4508-a941-039727e3fd84';

        if (user && userData) {
            // Boot ChannelTalk with user info
            window.ChannelIO?.('boot', {
                pluginKey: key,
                memberId: user.uid,
                profile: {
                    name: `${userData.lastName || ''} ${userData.firstName || ''}`.trim() || userData.displayName || userData.email || user.email || '未設定',
                    email: userData.email || user.email || '',
                    mobileNumber: userData.phoneNumber || '',
                    accountBalance: (userData.balance !== undefined && userData.balance !== null) ? userData.balance : "不明",
                    kycStatus: userData.kycStatus || '未完了'
                }
            });
        }

        return () => {
            window.ChannelIO?.('shutdown');
        };
    }, [user, userData]);
}
