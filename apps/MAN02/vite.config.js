/* global process, __dirname */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../../'), '');
  const combinedEnv = { ...rootEnv, ...env };

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
    server: {
      port: 5176,
      host: true
    }
  }
})
