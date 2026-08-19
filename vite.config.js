import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    strictPort: false
  },

  build: {
    outDir: 'static_build',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Đảm bảo các file CSS được tách riêng
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name].[hash].[ext]'
          }
          return 'assets/[name].[hash].[ext]'
        }
      }
    }
  },

  // Quan trọng: xử lý CSS đúng cách
  css: {
    preprocessorOptions: {
      // Nếu dùng SCSS/SASS
    }
  }
})
