import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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
          '/kuwo-data-api': {
            target: 'http://qukudata.kuwo.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/kuwo-data-api/, ''),
            headers: {
              'Referer': 'http://kuwo.cn/',
              'Origin': 'http://kuwo.cn/'
            }
          },
          '/kuwo-www-api': {
            target: 'http://www.kuwo.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/kuwo-www-api/, ''),
            headers: {
              'Referer': 'http://kuwo.cn/',
              'Origin': 'http://kuwo.cn/'
            }
          },
          '/random-music-api': {
            target: 'https://node.api.xfabe.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/random-music-api/, ''),
            headers: {
              'Referer': 'https://node.api.xfabe.com/',
              'Origin': 'https://node.api.xfabe.com/'
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
          },
          '/cy-api': {
            target: 'https://cyapi.top',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/cy-api/, ''),
            headers: {
              'Referer': 'https://cyapi.top/',
              'Origin': 'https://cyapi.top/'
            }
          },
          '/yunzhi-api': {
            target: 'https://yunzhiapi.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/yunzhi-api/, ''),
            headers: {
              'Referer': 'https://yunzhiapi.cn/',
              'Origin': 'https://yunzhiapi.cn/'
            }
          },
          '/gdstudio-api': {
            target: 'https://music-api.gdstudio.xyz',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/gdstudio-api/, ''),
            headers: {
              'Referer': 'https://music-api.gdstudio.xyz/',
              'Origin': 'https://music-api.gdstudio.xyz/',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
            }
          },
          '/alger-api': {
            target: 'http://mc.alger.fun',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/alger-api/, ''),
            headers: {
              'Referer': 'http://mc.alger.fun/',
              'Origin': 'http://mc.alger.fun/',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
              'Cookie': 'Hm_lvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; Hm_lpvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; HMACCOUNT=391951E145164861; Hm_lvt_27b3850e627d266b20b38cce19af18f7=1770619363; Hm_lpvt_27b3850e627d266b20b38cce19af18f7=1770619363; NMTID=00OJmnLN0vuY4_DNEWjghYex0iwyA4AAAGcQSUqFw'
            }
          }
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      },
      optimizeDeps: {
        include: [
          '@tiptap/react',
          '@tiptap/starter-kit',
          '@tiptap/extension-link',
          '@tiptap/extension-image',
          '@tiptap/extension-placeholder',
          '@tiptap/markdown'
        ]
      },
      plugins: [
        react(),
        tailwindcss()
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
