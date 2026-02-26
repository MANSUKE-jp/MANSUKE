export const CONFIG = {
  APP_NAME: "MANSUKE HIRUSUPA",
  VERSION: "2.3", // バージョンを少し上げておきますね

  // 認証ID (.envのVITE_AUTH_IDから読み込みます)
  AUTH_ID: import.meta.env.VITE_AUTH_ID || "",

  GEMINI: {
    API_KEY: import.meta.env.VITE_GEMINI_API_KEY || "",
    MODEL: "gemini-2.5-flash",
  },

  FIREBASE: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    // Realtime DatabaseのURLを追加
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
  },

  PROXY_URL: import.meta.env.VITE_PROXY_URL || "",

  FORMS: {
    PRODUCTION: {
      URL: "https://docs.google.com/forms/d/e/1FAIpQLSdtMeBv7uoypEIhSe_jv-1illNDSNmKS3YgVdO-p4XCCl0UYw/formResponse",
      VIEW_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdtMeBv7uoypEIhSe_jv-1illNDSNmKS3YgVdO-p4XCCl0UYw/viewform",
      FIELDS: {
        EMAIL: "entry.2016219517",
        RADIO_NAME: "entry.1736029699",
        SONG: "entry.1050674504",
        ANTI_BOT: "entry.1001222241",
      }
    },

    DEMO: {
      URL: "https://docs.google.com/forms/d/e/.FAIpQLSeAKhOhTylZGCDHs3UmJT_Jvq09TLSqym2zXlPLUWflIeHiiA/formResponse",
      VIEW_URL: "https://docs.google.com/forms/d/e/1FAIpQLSeAKhOhTylZGCDHs3UmJT_Jvq09TLSqym2zXlPLUWflIeHiiA/viewform",
      FIELDS: {
        EMAIL: "emailAddress",
        RADIO_NAME: "entry.1933512626",
        SONG: "entry.1376784639",
        ANTI_BOT: null,
      }
    }
  }
};