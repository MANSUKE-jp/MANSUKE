import { CONFIG } from '../config/env';

/**
 * Cloudflare Worker経由でリクエストを送信するクライアント
 * * fetch API版
 */
export const proxyClient = {
  /**
   * GETリクエスト (HTML取得用)
   */
  get: async (targetUrl) => {
    if (!CONFIG.PROXY_URL) {
      throw new Error("Cloudflare WorkersのURLが設定されていません。");
    }

    const proxyUrl = `${CONFIG.PROXY_URL}?target=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details');
      throw new Error(`GET Error (${response.status}): ${errorText}`);
    }

    const text = await response.text();
    return { data: text };
  },

  /**
   * POSTリクエスト (フォーム送信用)
   */
  post: async (targetUrl, params) => {
    if (!CONFIG.PROXY_URL) {
      throw new Error("Cloudflare WorkersのURLが設定されていません。");
    }

    const proxyUrl = `${CONFIG.PROXY_URL}?target=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // URLSearchParamsオブジェクトを文字列化して送信
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details');
      throw new Error(`POST Error (${response.status}): 送信失敗`);
    }

    return { status: response.status };
  }
};