// ゲーム開始・進行管理系のハンドラー

const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore("werewolf");

const { TIME_LIMITS } = require('../constants');
const { shuffle, generateMatchId } = require('../utils');
const { applyPhaseChange } = require('../core');
const { executeEffects } = require('../effects');

// ★追加：役職リクエスト処理
// カウントダウン中にプレイヤーが希望役職を選択した時に呼ばれます
exports.submitRoleRequestHandler = async (request) => {
  try {
    // 認証確認
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const { roomCode, roleId, receiptId } = request.data;
    const uid = request.auth.uid;

    if (!roomCode || !roleId || !receiptId) {
      throw new HttpsError('invalid-argument', '無効なリクエストです(receiptIdが必要です)');
    }

    const roomRef = db.collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    await db.runTransaction(async (t) => {
      const roomSnap = await t.get(roomRef);
      if (!roomSnap.exists) throw new HttpsError('not-found', '部屋が見つかりません');

      const room = roomSnap.data();

      // 不正防止：カウントダウン中（ゲーム開始直前）のみリクエストを受け付ける
      if (room.phase !== 'countdown') {
        throw new HttpsError('failed-precondition', '現在は役職リクエストを受け付けていません');
      }

      // 既存リクエストがあればキャンセル
      // ※ここではシンプルに上書きしますが、厳密には古いレシートを返金するロジックが必要な場合があります
      // 今回はカウントダウン中の「OK」ボタン押下後にisLockedになるため、上書きは発生しない前提

      // リクエストを保存
      t.update(roomRef, {
        [`roleRequests.${uid}`]: { roleId, receiptId }
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[submitRoleRequestHandler] Error:", error);
    throw new HttpsError('internal', `役職リクエストに失敗しました: ${error.message}`);
  }
};

// ゲーム開始処理
// 部屋の作成者が開始ボタンを押したときに呼ばれる想定
exports.startGameHandler = async (request) => {
  try {
    // 認証確認。未ログインは弾く
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');

    const batch = db.batch();

    const { roomCode } = request.data;
    // Firestoreのパス参照
    // 公開データ直下のroomsコレクション
    const roomRef = db.collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);
    const roomSnap = await roomRef.get();

    // 部屋存在チェック
    if (!roomSnap.exists) throw new HttpsError('not-found', '部屋なし');

    // プレイヤー一覧取得
    // 観戦者(isSpectator)は除外して、参加者のみ抽出
    const playersSnap = await roomRef.collection('players').get();
    const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.isSpectator);

    // 最低人数チェック。4人未満は不可
    if (players.length < 4) throw new HttpsError('failed-precondition', '人数不足');

    // 役職設定取得。未設定なら空オブジェクト
    const roleSettings = roomSnap.data().roleSettings || {};
    let roles = [];
    let wolfCount = 0, humanCount = 0;

    // 設定に基づき役職配列を展開
    // 例: { werewolf: 2, villager: 3 } -> ['werewolf', 'werewolf', 'villager', '...', 'villager']
    Object.entries(roleSettings).forEach(([r, c]) => {
      for (let i = 0; i < c; i++) {
        roles.push(r);
        // 人狼陣営の数をカウント
        // 賢狼(wise_wolf)も人狼カウントに含める。これ重要
        if (['werewolf', 'greatwolf', 'wise_wolf'].includes(r)) wolfCount++;
        else humanCount++;
      }
    });

    // 参加人数と役職総数の不整合チェック
    if (roles.length !== players.length) throw new HttpsError('invalid-argument', '人数不一致');

    // ゲームバランスチェック
    // 人狼0人は不可（賢狼のみでもwolfCount増えるのでOK）
    if (wolfCount === 0) throw new HttpsError('failed-precondition', '人狼がいません');
    // 人狼が過半数以上は即ゲーム終了条件なので開始不可
    if (wolfCount >= humanCount) throw new HttpsError('failed-precondition', '人狼過半数');

    // [変更] 役職の割り当てはカウントダウン終了後に行うように変更
    // ここでは役職設定(roleSettings)を部屋データに保存し、役職リクエスト(roleRequests)を初期化するのみ

    // 各プレイヤーの状態初期化
    players.forEach(p => {
      batch.update(roomRef.collection('players').doc(p.id), {
        isReady: false,
        status: 'alive',
        deathReason: admin.firestore.FieldValue.delete(),
        diedDay: admin.firestore.FieldValue.delete()
      });
    });

    // マッチID生成（ログ分析用など）
    const matchId = generateMatchId();

    // 部屋情報の更新：ゲーム開始状態へ
    batch.update(roomRef, {
      status: 'playing',
      phase: 'countdown', // 最初はカウントダウンから
      phaseStartTime: admin.firestore.Timestamp.now(),
      day: 1,
      matchId: matchId,
      roleSettings: roleSettings, // 役職設定を保存（後で割り当てるため）
      roleRequests: {},           // 役職リクエストを初期化
      logs: [{ text: "ゲームが開始されました。", phase: "System", day: 1 }],
      // 夜アクション系データ初期化
      nightActions: {}, nightLeaders: {}, pendingActions: {}, awakeningEvents: [],
      // 終了判定系データクリア
      winner: admin.firestore.FieldValue.delete(),
      nightAllDoneTime: admin.firestore.FieldValue.delete(),
      executionResult: admin.firestore.FieldValue.delete(),
      deathResult: admin.firestore.FieldValue.delete(),
      voteSummary: admin.firestore.FieldValue.delete(),
      assassinUsed: false,
      teruteruWon: admin.firestore.FieldValue.delete()
    });

    // 一括コミット
    await batch.commit();
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[startGameHandler] Error:", error);
    throw new HttpsError('internal', `ゲーム開始エラー: ${error.message}`);
  }
};

// フェーズ進行監視ハンドラー
// クライアントからの定期ポーリングやタイマートリガーで呼ばれる想定
exports.advancePhaseHandler = async (request) => {
  try {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode } = request.data;
    const roomRef = db.collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);

    const result = await db.runTransaction(async (t) => {
      const rSnap = await t.get(roomRef);
      if (!rSnap.exists) return;
      const room = rSnap.data();
      const now = Date.now();

      // 開始時刻取得。なければ0
      const startTime = room.phaseStartTime && typeof room.phaseStartTime.toMillis === 'function' ? room.phaseStartTime.toMillis() : 0;
      const elapsed = (now - startTime) / 1000; // 経過秒数
      let duration = 9999;

      // 現在のフェーズに応じて制限時間を決定
      if (room.phase.startsWith('day')) duration = room.discussionTime || TIME_LIMITS.DISCUSSION; // 昼の議論
      else if (room.phase === 'voting') duration = TIME_LIMITS.VOTING; // 投票
      else if (room.phase.startsWith('announcement')) duration = TIME_LIMITS.ANNOUNCEMENT; // 結果発表など
      else if (room.phase === 'countdown') duration = TIME_LIMITS.COUNTDOWN; // 開始前カウントダウン
      else if (room.phase === 'role_reveal') duration = TIME_LIMITS.ROLE_REVEAL; // 役職確認
      else if (room.phase.startsWith('night')) duration = TIME_LIMITS.NIGHT; // 夜

      // タイムアップ判定（バッファ2秒考慮？）
      const isTimeUp = elapsed >= duration - 2;
      // 夜の強制終了判定
      const isNightForce = room.phase.startsWith('night') && isTimeUp;
      // 夜の全員行動完了による早期終了判定
      const isNightAllDone = room.nightAllDoneTime && typeof room.nightAllDoneTime.toMillis === 'function' && now >= room.nightAllDoneTime.toMillis();

      // 時間内かつ、夜の早期終了でもなければ何もしない
      if (!isTimeUp && !isNightForce && !isNightAllDone) return;

      // フェーズ遷移処理へ

      // プレイヤー情報取得
      const pSnap = await t.get(roomRef.collection('players'));
      const secretRefs = pSnap.docs.map(d => d.ref.collection('secret').doc('roleData'));
      const secretSnaps = await Promise.all(secretRefs.map(ref => t.get(ref)));
      const players = pSnap.docs.map((d, i) => {
        const pData = { id: d.id, ...d.data() };
        if (secretSnaps[i].exists) {
          const sData = secretSnaps[i].data();
          pData.role = sData.role; // 役職情報付与
          pData.elderShield = sData.elderShield;
        }
        return pData;
      });

      // 投票フェーズなら投票結果も取得しておく
      if (room.phase === 'voting') {
        const vSnap = await t.get(roomRef.collection('votes'));
        room.votes = vSnap.docs.map(d => d.data());
      }

      // 夜終了フラグセット
      const options = {};
      if (isNightForce || isNightAllDone) {
        options.forceNightEnd = true;
      }

      // 実際のフェーズ変更処理を実行（coreモジュール）
      const applyResult = await applyPhaseChange(t, roomRef, room, players, options);
      console.log(`[advancePhase] applyPhaseChange result:`, !!applyResult);
      return applyResult;
    });

    console.log(`[advancePhase] Transaction committed for room ${roomCode}. Result:`, !!result);

    // トランザクション完了後にサイドエフェクト（料金徴収など）を実行
    if (result && result.effects) {
      console.log(`[advancePhase] Executing ${result.effects.length} effects for room ${roomCode}`);
      await executeEffects(result.effects);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error(`[advancePhaseHandler] Error in room ${request.data?.roomCode}:`, error);
    // エラーが起きた場合はクラッシュさせず、詳細をフロントエンドに返す
    throw new HttpsError('internal', `フェーズ進行に失敗しました: ${error.message}`);
  }
};

// 準備完了トグルハンドラー
// 議論開始前の確認などで使用
exports.toggleReadyHandler = async (request) => {
  try {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const { roomCode, isReady } = request.data;
    const uid = request.auth.uid;
    const roomRef = db.collection('artifacts').doc('mansuke-jinro').collection('public').doc('data').collection('rooms').doc(roomCode);
    const playerRef = roomRef.collection('players').doc(uid);

    const result = await db.runTransaction(async (t) => {
      const rSnap = await t.get(roomRef);
      if (!rSnap.exists) throw new HttpsError('not-found', 'Room not found');
      const room = rSnap.data();

      // 昼フェーズでの時短用準備完了チェックを行うか
      const shouldCheckAdvance = isReady && room.phase.startsWith('day');

      // 単なるステータス更新の場合
      if (!shouldCheckAdvance) { t.update(playerRef, { isReady: isReady }); return; }

      // 全員準備完了ならフェーズを進める処理
      const pSnap = await t.get(roomRef.collection('players'));
      const secretRefs = pSnap.docs.map(d => d.ref.collection('secret').doc('roleData'));
      const secretSnaps = await Promise.all(secretRefs.map(ref => t.get(ref)));

      const players = pSnap.docs.map((d, i) => {
        const pData = { id: d.id, ...d.data() };
        if (secretSnaps[i].exists) {
          const sData = secretSnaps[i].data();
          pData.role = sData.role;
          pData.elderShield = sData.elderShield;
        }
        return pData;
      });

      // 自分のステータスをメモリ上で更新
      const me = players.find(p => p.id === uid); if (me) me.isReady = true;

      // 生存者全員がReadyかチェック
      const alive = players.filter(p => p.status === 'alive');
      const allReady = alive.every(p => p.isReady);

      // 全員Readyならフェーズ進行
      if (allReady) {
        const applyResult = await applyPhaseChange(t, roomRef, room, players);
        return applyResult;
      }
      // まだなら自分のステータスだけDB更新
      else { t.update(playerRef, { isReady: isReady }); }
    });

    if (result && result.effects) {
      await executeEffects(result.effects);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[toggleReadyHandler] Error:", error);
    throw new HttpsError('internal', `準備完了の更新に失敗しました: ${error.message}`);
  }
};