// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'   // 이미 들어 있는 React 플러그인
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),      // ← 이것만 추가
  ],
})
