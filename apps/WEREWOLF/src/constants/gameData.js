import { Shield, Moon, Ghost, Search, Skull, Eye, Crosshair, Users, Zap, Swords, UserMinus, User, Heart, Crown, HelpCircle, Gift } from 'lucide-react';

// ハートビート更新間隔 (ms)
export const HEARTBEAT_INTERVAL_MS = 20000;

// オフライン判定のタイムアウト時間 (ms)
export const OFFLINE_TIMEOUT_MS = 60000;

// 議論時間の設定 (秒)
export const TIME_LIMITS = {
    MIN: 60,
    MAX: 600,
    DEFAULT: 240,
    INCREMENT: 10,
    // フェーズ別固定時間 (functions/src/constants.js と同期)
    VOTING: 20,
    NIGHT: 86400,
    ANNOUNCEMENT: 10,
    COUNTDOWN: 15,
    ROLE_REVEAL: 3
};

export const ROLE_DEFINITIONS = {
    // 市民陣営
    citizen: {
        name: '市民',
        icon: User,
        desc: '特殊能力はありません。推理と議論で人狼を探します。',
        team: 'citizen'
    },
    seer: {
        name: '占い師',
        icon: Eye,
        desc: '毎晩1人を占い、「人狼」か「人狼ではない」かを知ることができます。',
        team: 'citizen'
    },
    medium: {
        name: '霊媒師',
        icon: Ghost,
        desc: '昼に処刑された人が、「人狼だった」か「人狼ではなかった」かを知ることができます。',
        team: 'citizen'
    },
    knight: {
        name: '騎士',
        icon: Shield,
        desc: '毎晩1人を人狼の襲撃から守ります。2夜連続同じ人を守る事はできません。',
        team: 'citizen'
    },
    trapper: {
        name: '罠師',
        icon: Crosshair,
        desc: '騎士の能力に加え、護衛した先が襲撃されると、襲撃してきた人狼を返り討ちにして死亡させます。',
        team: 'citizen'
    },
    sage: {
        name: '賢者',
        icon: Search,
        desc: '毎晩1人を占い、その人の正確な役職名を知ることができます。',
        team: 'citizen'
    },
    killer: {
        name: '人狼キラー',
        icon: Swords,
        desc: '人狼に襲撃されると死亡しますが、襲撃してきた人狼1人を道連れにします。',
        team: 'citizen'
    },
    detective: {
        name: '名探偵',
        icon: Search,
        desc: '誰かが死亡した日の夜に、その死因や正体に関する情報を知ることができます。',
        team: 'citizen'
    },
    elder: {
        name: '長老',
        icon: Crown,
        desc: '人狼の襲撃を1度だけ耐えることができます。',
        team: 'citizen'
    },
    assassin: {
        name: 'ももすけ', // ももすけ
        icon: Skull,
        desc: '夜に一度だけ、護衛をも貫通して1人の存在意義を抹消する（暗殺する）ことができます。',
        team: 'citizen'
    },

    // 人狼陣営
    werewolf: {
        name: '人狼',
        icon: Moon,
        desc: '夜に仲間と相談して市民1人を襲撃します。',
        team: 'werewolf'
    },
    greatwolf: {
        name: '大狼',
        icon: Users, // 変更検討
        desc: '占われても「人狼ではない」と判定される、強力な人狼です。',
        team: 'werewolf'
    },
    wise_wolf: {
        name: '賢狼',
        icon: Zap,
        desc: '生存している間、襲撃先のプレイヤーの正確な役職を人狼チームに提供する人狼です。',
        team: 'werewolf'
    },
    madman: {
        name: '狂人',
        icon: UserMinus,
        desc: '人狼の味方をする市民です。嘘をついて場を混乱させます。',
        team: 'werewolf'
    },

    // 第三陣営
    fox: {
        name: '妖狐',
        icon: Heart,
        desc: '人狼に襲撃されても死にませんが、占われると呪い殺されます。最後まで生き残れば単独勝利です。',
        team: 'third'
    },
    teruteru: {
        name: 'てるてる',
        icon: HelpCircle,
        desc: '昼の投票で処刑されると、最終的な勝利陣営に加え追加で勝利となります。',
        team: 'third'
    },
    cursed: {
        name: '呪われし者',
        icon: Skull,
        desc: '最初は市民としてカウントされますが、人狼に襲撃されると死亡せず、人狼陣営に覚醒します。',
        team: 'third'
    }
};

export const ROLE_GROUPS = {
    citizen: ['citizen', 'seer', 'medium', 'knight', 'trapper', 'sage', 'killer', 'detective', 'elder', 'assassin'],
    werewolf: ['werewolf', 'greatwolf', 'wise_wolf', 'madman'],
    third: ['fox', 'teruteru', 'cursed'] // サンタを一旦削除
};

export const ROLE_NAMES = Object.keys(ROLE_DEFINITIONS).reduce((acc, key) => {
    acc[key] = ROLE_DEFINITIONS[key].name;
    return acc;
}, {});