// 部屋管理・プレイヤー管理系のハンドラー

const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const getDb = () => getFirestore("werewolf");

const { checkWin } = require('../utils');
// archiveGameは強制終了時や決着時にゲームデータを保存する関数
const { checkNightCompletion, applyPhaseChange, archiveGame } = require('../core');
const { executeEffects } = require('../effects');

// 観戦者参加ハンドラー
// 途中参加や、定員オーバー時の観戦希望などで使用
exports.joinSpectatorHandler = async (request) => {
    // 認証チェック
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode, nickname, isDev } = request.data;
    const uid = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await getDb().runTransaction(async (t) => {
        // 部屋存在確認
        const roomSnap = await t.get(roomRef);
        if (!roomSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');
        const room = roomSnap.data();

        // プレイヤーデータ作成（観戦者フラグON）
        // ステータスはdead扱いにしておく（ゲーム進行に影響させないため）
        const playerRef = roomRef.collection('players').doc(uid);
        const playerData = {
            name: nickname,
            status: 'dead', // 観戦者は死者扱い
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            isSpectator: true
        };

        // 開発者フラグがある場合は保存（デバッグ用権限などに使用）
        if (isDev) {
            playerData.isDev = true;
        }

        // プレイヤー書き込み
        t.set(playerRef, playerData);

        // 入室通知ログを追加
        t.update(roomRef, {
            notificationEvent: {
                message: `${nickname}が観戦者として途中参加しました。`,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
        });
    });
    return { success: true };
};

// 部屋削除ハンドラー
// 部屋とそれに紐づくサブコレクションを全て削除する
exports.deleteRoomHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    const batch = getDb().batch();

    // 削除対象のサブコレクション一覧
    const subcollections = ['chat', 'teamChats', 'graveChat', 'votes', 'players'];

    // サブコレクション内のドキュメントをループして削除バッチに追加
    for (const subColName of subcollections) {
        const snap = await roomRef.collection(subColName).get();
        for (const doc of snap.docs) {
            batch.delete(doc.ref);
            // プレイヤーの場合はさらに下層のsecretコレクションも削除必要
            if (subColName === 'players') {
                batch.delete(doc.ref.collection('secret').doc('roleData'));
                batch.delete(doc.ref.collection('secret').doc('actionResult'));
            }
        }
    }

    // 部屋ドキュメント自体を削除
    batch.delete(roomRef);

    // 一括削除実行
    await batch.commit();
    return { success: true };
};

// ゲーム強制終了ハンドラー
// ホストがゲームを中断する場合に使用
exports.abortGameHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await getDb().runTransaction(async (t) => {
        const rSnap = await t.get(roomRef);
        if (!rSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');
        const room = rSnap.data();

        // アーカイブ保存用に全プレイヤー情報（役職含む）を取得
        const pSnap = await roomRef.collection('players').get();
        const secretRefs = pSnap.docs.map(d => d.ref.collection('secret').doc('roleData'));
        const secretSnaps = await db.getAll(...secretRefs);

        // プレイヤーデータの結合
        const players = pSnap.docs.map((d, i) => {
            const p = { id: d.id, ...d.data() };
            if (secretSnaps[i].exists) p.role = secretSnaps[i].data().role;
            return p;
        });

        // 部屋ステータス更新：aborted
        const updates = {
            status: 'aborted',
            logs: admin.firestore.FieldValue.arrayUnion({
                text: "ホストがゲームを強制終了しました。",
                phase: "System",
                day: room.day || 1
            })
        };

        t.update(roomRef, updates);

        // 強制終了時の状態を別コレクションへアーカイブ保存
        // ログ分析や振り返り機能に使用
        await archiveGame(t, roomRef, { ...room, ...updates }, players, 'aborted');
    });
    return { success: true };
};

// プレイヤー追放ハンドラー
// 荒らし対策や不在プレイヤーの排除用
exports.kickPlayerHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode, playerId } = request.data;
    const requesterId = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    try {
        const result = await getDb().runTransaction(async (t) => {
            // 1. 全ての読み取り操作を最初に行う（トランザクション制約）
            const rSnap = await t.get(roomRef);
            if (!rSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');
            const room = rSnap.data();

            const requesterRef = roomRef.collection('players').doc(requesterId);
            const pRef = roomRef.collection('players').doc(playerId);
            const [requesterSnap, pSnap] = await Promise.all([t.get(requesterRef), t.get(pRef)]);

            if (!pSnap.exists) throw new HttpsError('not-found', 'プレイヤーが見つかりません');

            const isHost = room.hostId === requesterId;
            const isDev = requesterSnap.exists && requesterSnap.data().isDev === true;

            // 権限なしエラー
            if (!isHost && !isDev) {
                throw new HttpsError('permission-denied', '権限がありません');
            }

            const pData = pSnap.data();
            const pName = pData.name;
            const currentDay = room.day || 1;

            // --- A. ロビー（待機中）の場合：単純削除 ---
            if (room.status === 'waiting') {
                t.delete(pRef);
                t.update(roomRef, {
                    logs: admin.firestore.FieldValue.arrayUnion({ text: `${pName}がホスト/管理者により追放されました。`, phase: "Lobby", day: currentDay })
                });
                return { success: true, mode: 'lobby' };
            }

            // --- B. 観戦者の場合：単純削除 ---
            if (pData.isSpectator) {
                t.delete(pRef);
                t.update(roomRef, {
                    logs: admin.firestore.FieldValue.arrayUnion({ text: `${pName}(観戦者)がホスト/管理者により追放されました。`, phase: "System", day: currentDay })
                });
                return { success: true, mode: 'spectator' };
            }

            // --- C. ゲーム中のプレイヤー追放（死亡扱い） ---
            // 役職情報一括取得のために正規のQuerySnapshot取得 (transaction外で行うのが安全)
            const allPlayersSnap = await roomRef.collection('players').get();
            const playerDocs = allPlayersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 役職情報一括取得
            const secretRefs = playerDocs.map(p => roomRef.collection('players').doc(p.id).collection('secret').doc('roleData'));
            const secretSnaps = await getDb().getAll(...secretRefs);

            const playersWithRoles = playerDocs.map((p, i) => {
                const sSnap = secretSnaps[i];
                return { ...p, role: sSnap.exists ? sSnap.data().role : null };
            });

            // 対象者を死亡ステータスへ
            t.update(pRef, { status: 'dead', deathReason: 'ホストによる追放', diedDay: currentDay });
            t.update(roomRef, {
                logs: admin.firestore.FieldValue.arrayUnion({ text: `${pName}がホスト/管理者により追放されました。`, phase: "System", day: currentDay })
            });

            // メモリ上のデータを更新して勝敗判定
            const updatedPlayers = playersWithRoles.map(p => p.id === playerId ? { ...p, status: 'dead' } : p);
            const deadIds = updatedPlayers.filter(p => p.status === 'dead' || p.status === 'vanished').map(p => p.id);
            const winner = checkWin(updatedPlayers, deadIds);

            if (winner) {
                t.update(roomRef, { status: 'finished', winner: winner });
                await archiveGame(t, roomRef, { ...room, status: 'finished', winner }, updatedPlayers, 'finished', winner);
            } else if (room.phase && room.phase.startsWith('night')) {
                await checkNightCompletion(t, roomRef, room, updatedPlayers);
            } else if (room.phase && room.phase.startsWith('day')) {
                const alive = updatedPlayers.filter(p => p.status === 'alive');
                const allReady = alive.every(p => p.isReady);
                if (allReady && alive.length > 0) {
                    return await applyPhaseChange(t, roomRef, room, updatedPlayers);
                }
            }

            return { success: true, mode: 'game' };
        });

        if (result && result.effects) {
            await executeEffects(result.effects);
        }
        return { success: true };
    } catch (e) {
        console.error('kickPlayerHandler Error:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message || '内部エラーが発生しました');
    }

};

// 全プレイヤー役職取得ハンドラー
// ゲーム終了後や管理者が役職一覧を見るために使用
exports.getAllPlayerRolesHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const uid = request.auth.uid;

    // 部屋情報取得
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) throw new HttpsError('not-found', 'Room not found');
    const room = roomSnap.data();

    // 自分の情報取得（権限チェック用）
    const pSnap = await roomRef.collection('players').get();
    const meDoc = pSnap.docs.find(d => d.id === uid);
    const me = meDoc ? meDoc.data() : null;

    // 閲覧権限判定
    const status = room.status;
    const isFinished = status === 'finished' || status === 'closed' || status === 'aborted';

    const isHost = room.hostId === uid; // ホスト
    const isDead = me && (me.status === 'dead' || me.status === 'vanished'); // 死亡者
    const isDev = me && me.isDev === true; // 開発者
    const isSpectator = me && me.isSpectator === true; // 観戦者

    // 終了後は全員OK。未終了時はホストであっても参加中の生存者は閲覧不可
    let isAllowed = false;
    if (isFinished || isDead || isDev || isSpectator) {
        isAllowed = true;
    } else if (isHost) {
        // 未終了時のホストの特例：ロビー待機中、またはごく稀にプレイヤードキュメントが存在しない場合のみ許可
        if (status === 'waiting' || !me) {
            isAllowed = true;
        }
    }

    if (!isAllowed) {
        throw new HttpsError('permission-denied', `権限がありません (status:${status})`);
    }

    // 全員の役職情報を取得して返す
    const playersData = [];
    // 複数ドキュメントの一括取得
    const secretRefs = pSnap.docs.map(d => d.ref.collection('secret').doc('roleData'));
    const secretSnaps = await getDb().getAll(...secretRefs);

    pSnap.docs.forEach((d, i) => {
        const p = { id: d.id, ...d.data() };
        // 役職情報を付与
        if (secretSnaps[i].exists) {
            const sData = secretSnaps[i].data();
            p.role = sData.role;
            p.originalRole = sData.originalRole; // 変化前の役職もあれば
        }
        playersData.push(p);
    });

    return { players: playersData };
};

// ホスト権限移行ハンドラー
// ホストが抜ける前などに権限を他人に移す
exports.migrateHostHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const uid = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await getDb().runTransaction(async (t) => {
        const rSnap = await t.get(roomRef);
        if (!rSnap.exists) return;
        const room = rSnap.data();

        // 既に自分がホストなら何もしない
        if (room.hostId === uid) return;

        // 早い者勝ちでホスト権限を取得するロジック（UI側の実装に依存）
        // 現状はリクエストした人がホストになる単純な仕組み
        t.update(roomRef, { hostId: uid });
    });
    return { success: true };
};

// ロビーへのリセット（再戦）ハンドラー
// ゲーム終了後、同じメンバーで再ゲームを行うための初期化
exports.resetToLobbyHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);
    const batch = getDb().batch();

    // 各種コレクションのクリーンアップ（チャット、投票など）
    const chatSnap = await roomRef.collection('chat').get();
    const teamChatSnap = await roomRef.collection('teamChats').get();
    const graveChatSnap = await roomRef.collection('graveChat').get();
    const voteSnap = await roomRef.collection('votes').get();
    const playerSnap = await roomRef.collection('players').get();

    // 削除バッチへの追加
    chatSnap.docs.forEach(d => batch.delete(d.ref));
    teamChatSnap.docs.forEach(d => batch.delete(d.ref));
    graveChatSnap.docs.forEach(d => batch.delete(d.ref));
    voteSnap.docs.forEach(d => batch.delete(d.ref));

    // プレイヤー状態のリセット
    playerSnap.docs.forEach(d => {
        const updates = {
            status: 'alive',
            isReady: false,
            // 観戦者は削除されるか、aliveに戻るか？ここでは削除フィールド指定
            isSpectator: admin.firestore.FieldValue.delete(),
            deathReason: admin.firestore.FieldValue.delete(),
            diedDay: admin.firestore.FieldValue.delete(),
            lastTarget: admin.firestore.FieldValue.delete()
        };
        batch.update(d.ref, updates);
        // 個人の秘密情報（役職、アクション結果）も削除
        batch.delete(d.ref.collection('secret').doc('roleData'));
        batch.delete(d.ref.collection('secret').doc('actionResult'));
    });

    // 部屋情報の初期化
    batch.update(roomRef, {
        status: 'waiting',
        phase: 'lobby',
        day: 1,
        logs: [],
        // ゲーム結果関連のフィールド削除
        winner: admin.firestore.FieldValue.delete(),
        nightActions: admin.firestore.FieldValue.delete(),
        nightLeaders: admin.firestore.FieldValue.delete(),
        pendingActions: admin.firestore.FieldValue.delete(),
        awakeningEvents: admin.firestore.FieldValue.delete(),
        nightAllDoneTime: admin.firestore.FieldValue.delete(),
        executionResult: admin.firestore.FieldValue.delete(),
        deathResult: admin.firestore.FieldValue.delete(),
        voteSummary: admin.firestore.FieldValue.delete(),
        phaseStartTime: admin.firestore.FieldValue.serverTimestamp(),
        assassinUsed: admin.firestore.FieldValue.delete(),
        matchId: admin.firestore.FieldValue.delete(),
        teruteruWon: admin.firestore.FieldValue.delete(),
        notificationEvent: admin.firestore.FieldValue.delete()
    });


    await batch.commit();
    return { success: true };
};

// 部屋作成ハンドラー
exports.createRoomHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { nickname, isDev } = request.data;
    if (!nickname) throw new HttpsError('invalid-argument', '名前が入力されていません');

    const uid = request.auth.uid;
    const roomsRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms');

    // 部屋コード生成 (1000-9999)
    let code;
    let roomRef;
    let isUnique = false;

    // コードのユニークチェック（安全対策だが、10000の部屋が同時に立たないので数回で済む想定）
    for (let i = 0; i < 10; i++) {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        roomRef = roomsRef.doc(code);
        const snap = await roomRef.get();
        if (!snap.exists) {
            isUnique = true;
            break;
        }
    }

    if (!isUnique) {
        throw new HttpsError('internal', '部屋の生成に失敗しました。再度お試しください。');
    }

    const defaultSettings = { citizen: 1, werewolf: 1, seer: 1, medium: 0, knight: 1, trapper: 0, sage: 0, killer: 0, detective: 0, cursed: 0, elder: 0, greatwolf: 0, madman: 0, fox: 0, assassin: 0, teruteru: 0 };

    const batch = getDb().batch();

    // 部屋ドキュメント作成
    batch.set(roomRef, {
        hostId: uid,
        hostName: nickname,
        status: 'waiting',
        phase: 'lobby',
        roleSettings: defaultSettings,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        logs: [],
        anonymousVoting: true,
        inPersonMode: false
    });

    // ホストプレイヤー作成
    const playerData = {
        name: nickname,
        status: 'alive',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        isSpectator: false
    };
    if (isDev) playerData.isDev = true;

    batch.set(roomRef.collection('players').doc(uid), playerData);

    await batch.commit();

    return { roomCode: code };
};

// 部屋参加ハンドラー（通常参加）
exports.joinRoomHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode, nickname, isDev } = request.data;
    if (!nickname || !roomCode || roomCode.length !== 4) {
        throw new HttpsError('invalid-argument', '入力エラー');
    }

    const uid = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await getDb().runTransaction(async (t) => {
        const roomSnap = await t.get(roomRef);
        if (!roomSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');
        if (roomSnap.data().status !== 'waiting') throw new HttpsError('failed-precondition', '部屋は既にゲーム中か終了しています');

        const playersRef = roomRef.collection('players');
        const playersSnap = await t.get(playersRef);

        let nameExists = false;
        playersSnap.forEach(doc => {
            if (doc.id !== uid && doc.data().name === nickname) {
                nameExists = true;
            }
        });

        if (nameExists) throw new HttpsError('already-exists', 'その名前は既に使用されています。');

        const playerData = {
            name: nickname,
            status: 'alive',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            isSpectator: false
        };
        if (isDev) playerData.isDev = true;

        t.set(playersRef.doc(uid), playerData);
    });

    return { success: true };
};

// 部屋退室ハンドラー
exports.leaveRoomHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode } = request.data;
    const uid = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await roomRef.collection('players').doc(uid).delete();
    return { success: true };
};

// 部屋設定更新ハンドラー
exports.updateRoomSettingsHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode, updateData } = request.data;
    const uid = request.auth.uid;
    const roomRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await getDb().runTransaction(async (t) => {
        const roomSnap = await t.get(roomRef);
        if (!roomSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');

        const isHost = roomSnap.data().hostId === uid;

        // 開発者かどうかの確認
        const playerSnap = await t.get(roomRef.collection('players').doc(uid));
        const isDev = playerSnap.exists && playerSnap.data().isDev === true;

        if (!isHost && !isDev) {
            throw new HttpsError('permission-denied', '設定を変更する権限がありません');
        }

        t.update(roomRef, updateData);
    });

    return { success: true };
};

// チャット送信ハンドラー
exports.sendChatMessageHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode, collectionName, messageData } = request.data;
    if (!roomCode || !collectionName || !messageData || !messageData.text) {
        throw new HttpsError('invalid-argument', '不正なリクエストです');
    }

    // セキュリティ対策: 許可されたコレクション名のみに制限
    const allowedCollections = ['chat', 'graveChat', 'teamChats', 'messages'];
    if (!allowedCollections.includes(collectionName)) {
        throw new HttpsError('invalid-argument', '不正なコレクション名です');
    }

    const uid = request.auth.uid;
    const roomDocRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    // セキュリティ対策: 送信者のステータスと役職を検証 (Firestoreルールの代わり)
    if (collectionName !== 'messages') { // messages はロビーチャット用
        const playerSnap = await roomDocRef.collection('players').doc(uid).get();
        if (!playerSnap.exists) {
            throw new HttpsError('permission-denied', 'プレイヤーが見つかりません');
        }
        const player = playerSnap.data();
        const isDeadOrSpectator = player.status === 'dead' || player.status === 'vanished' || player.isSpectator;

        if (collectionName === 'chat') {
            if (player.status !== 'alive') throw new HttpsError('permission-denied', '生存者のみ発言可能です');
        } else if (collectionName === 'graveChat') {
            if (!isDeadOrSpectator) throw new HttpsError('permission-denied', '死亡者または観戦者のみ発言可能です');
        } else if (collectionName === 'teamChats') {
            if (player.status !== 'alive') throw new HttpsError('permission-denied', '生存者のみ発言可能です');

            const roleSnap = await playerSnap.ref.collection('secret').doc('roleData').get();
            const role = roleSnap.exists ? roleSnap.data().role : null;
            const channel = messageData.channel;

            let canSpeak = false;
            if (channel === 'werewolf_team' && ['werewolf', 'greatwolf', 'wise_wolf'].includes(role)) canSpeak = true;
            else if (channel === 'madman' && role === 'madman') canSpeak = true;
            else if (channel === 'assassin' && role === 'assassin') canSpeak = true;
            else if (channel === role) canSpeak = true;

            if (!canSpeak) throw new HttpsError('permission-denied', '発言権限がありません');
        }
    }

    const chatRef = roomDocRef.collection(collectionName);

    // サーバーのタイムスタンプを使用
    const dataToSave = {
        ...messageData,
        senderId: uid, // 強制的にセッショントークンのUIDを使用
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await chatRef.add(dataToSave);
    return { success: true };
};

// 生存確認（Heartbeat）ハンドラー
exports.heartbeatHandler = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode } = request.data;
    const uid = request.auth.uid;

    if (!roomCode) throw new HttpsError('invalid-argument', '部屋コードがありません');

    const playerRef = getDb().collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode).collection('players').doc(uid);

    try {
        await playerRef.update({
            lastSeen: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        // 退室済みなどでドキュメントが存在しない場合は無視
        console.warn(`Heartbeat failed for ${uid} in room ${roomCode}`);
    }

    return { success: true };
};