import { functions } from "../config/firebase";
import { httpsCallable } from "firebase/functions";

/**
 * ラジオネームの在庫管理と生成を行うサービス
 */
class RadioNameService {
  constructor() {
    this.pool = [];
    this.totalAmount = 0;
    this.isRefilling = false;
    this.lastError = null; // エラーを保持するための変数を追加しました
  }

  /**
   * Gemini経由で名前を補充し、現在の合計金額を更新します
   */
  async refill(sessionId, receiptId) {
    if (this.isRefilling) return;
    if (!receiptId) {
      throw new Error("PAYMENT_REQUIRED");
    }

    this.isRefilling = true;
    this.lastError = null;

    try {
      const token = localStorage.getItem('mansuke_sso_token');
      const generateRadioNamesFn = httpsCallable(functions, 'generateRadioNamesFromGemini');
      const result = await generateRadioNamesFn({ sessionId, receiptId, token });

      if (result.data && Array.isArray(result.data.names)) {
        this.pool = [...this.pool, ...result.data.names];
        this.totalAmount += 5; // 1回の補充につき5円固定
      }
    } catch (error) {
      this.lastError = error; // 画面側に伝えるためにエラーを保持します
      throw error; // エラーを飲み込まずに投げます
    } finally {
      this.isRefilling = false;
    }
  }

  /**
   * 次のラジオネームを取得します。在庫が少なくなればエラーを投げて画面側に補充を促します。
   * @param {string} sessionId 
   * @param {string} [receiptId] - オプション。補充画面から渡された新しいレシートID
   */
  async getNextName(sessionId, receiptId = null) {
    // 補充用のレシートが渡された場合はまず補充する
    if (receiptId) {
      await this.refill(sessionId, receiptId);
    }

    // 前回バックグラウンドでエラーが起きていれば、即座に画面へ伝えます
    if (this.lastError) {
      const err = this.lastError;
      this.lastError = null;
      throw err;
    }

    // 在庫が少ない、かつ補充中でない場合は、画面側に支払いを要求する
    if (this.pool.length < 5 && !this.isRefilling) {
      // We throw PAYMENT_REQUIRED so the UI can show the modal
      this.lastError = new Error("PAYMENT_REQUIRED");
    }

    // 在庫が完全に切れている場合は補充を待つ（エラーを投げる）
    if (this.pool.length === 0) {
      throw new Error("PAYMENT_REQUIRED");
    }

    return this.pool.shift() || "まんすけ臨時";
  }

  /**
   * 現在のセッションの合計発生料金を取得します
   */
  getAmount() {
    return this.totalAmount;
  }
}

export const radioNameService = new RadioNameService();