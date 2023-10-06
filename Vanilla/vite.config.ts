import { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, './src/app'),
      '$': resolve(__dirname, './src/core'),
      '#': resolve(__dirname, './src/components'),
    },
  },
  server: {
    port: 3000,
  },
})
