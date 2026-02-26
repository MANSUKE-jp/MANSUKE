/* global process, __dirname */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../../'), '');
  const combinedEnv = { ...rootEnv, ...env }; // local env overrides rootEnv

  return {
    plugins: [react()],
    define: {
      ...Object.keys(combinedEnv).reduce((acc, key) => {
        if (key.startsWith('VITE_')) {
          acc[`import.meta.env.${key}`] = JSON.stringify(combinedEnv[key]);
        }
        return acc;
      }, {}),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true
    }
  }
})