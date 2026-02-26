/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../shared/!(node_modules)/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // エラー解消のため、カスタムカラー定義を追加
      colors: {
        background: '#ffffff', // bg-background 用
        foreground: '#0f172a', // text-foreground 用 (slate-900相当)
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'gradient-x': 'gradient-x 3s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
    },
  },
  plugins: [],
}