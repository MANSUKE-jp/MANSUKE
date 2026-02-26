/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Noto Sans JP', 'sans-serif'],
                display: ['Oswald', 'sans-serif'],
                mono: ['Monaco', 'Courier New', 'monospace'],
            },
            colors: {
                background: '#0a0a0a', // 深い黒
                surface: '#111111',    // わずかに明るい黒
                primary: '#d5b263',    // ゴールド（MANSUKEカラー）
                secondary: '#ffffff',  // 白
                accent: '#ccff00',     // ネオン（アクセント）
                error: '#ff3333',
            },
            cursor: {
                // デフォルトカーソルを消すための設定
                none: 'none',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}