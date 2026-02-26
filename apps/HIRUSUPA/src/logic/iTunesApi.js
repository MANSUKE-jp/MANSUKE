import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

// 共通の呼び出し関数
const callSearchFunction = async (mode, query, additionalParams = {}) => {
  try {
    // Cloud Functionsの 'searchiTunes' を呼び出す
    const searchiTunes = httpsCallable(functions, 'searchiTunes');

    const result = await searchiTunes({
      mode,
      query,
      ...additionalParams
    });

    return result.data;
  } catch (error) {
    throw error;
  }
};

/**
 * iTunes APIを使用してアーティストの曲名を取得します
 * (Cloud Functions経由)
 * @param {string} artistName - アーティスト名
 * @returns {Promise<string[]>} - 曲名の配列
 */
export const fetchSongsByArtist = async (artistName) => {
  return callSearchFunction('fetchSongsByArtist', artistName);
};

/**
 * アーティストを検索し、画像付きのリストを返します
 * (Cloud Functions経由)
 * @param {string} query - 検索ワード
 * @returns {Promise<Array>} - アーティスト情報の配列
 */
export const searchArtists = async (query) => {
  return callSearchFunction('searchArtists', query);
};

/**
 * 曲を検索し、ジャケット画像付きのリストを返します
 * (Cloud Functions経由)
 * @param {string} query - 曲名またはキーワード
 * @param {string|null} targetArtistName - (任意) 絞り込みたいアーティスト名
 * @returns {Promise<Array>} - 曲情報の配列
 */
export const searchTracks = async (query, targetArtistName = null) => {
  return callSearchFunction('searchTracks', query, { targetArtistName });
};

export default {
  fetchSongsByArtist,
  searchArtists,
  searchTracks
};