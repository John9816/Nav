import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/netease-api': {
            target: 'https://music.163.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/netease-api/, ''),
            headers: {
              'Referer': 'https://music.163.com/',
              'Origin': 'https://music.163.com/'
            }
          },
          '/qq-api': {
            target: 'https://u.y.qq.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/qq-api/, ''),
            headers: {
              'Referer': 'https://y.qq.com/',
              'Origin': 'https://y.qq.com/'
            }
          },
          '/kuwo-api': {
            target: 'http://search.kuwo.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/kuwo-api/, ''),
            headers: {
              'Referer': 'http://kuwo.cn/',
              'Origin': 'http://kuwo.cn/'
            }
          },
          '/music-api': {
            target: 'https://music.byebug.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/music-api/, '/api'),
            headers: {
              'Referer': 'https://music.byebug.cn/',
              'Origin': 'https://music.byebug.cn',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
              'priority': 'u=1, i',
              'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"macOS"',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'same-origin'
            }
          }
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      },
      plugins: [
        react()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});