import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // относительные пути — работает и на GitHub Pages, и внутри Telegram
  server: { host: true } // чтобы можно было открыть с телефона в той же сети
});
