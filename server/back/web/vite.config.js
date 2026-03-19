import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/** Dev-only: same as Axum `/{id}` for digits — serve SPA so /1, /2 work with `npm run dev`. */
function spaNumericRoutes() {
  return {
    name: 'spa-numeric-routes',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url?.split('?')[0] ?? ''
        if (/^\/\d+\/?$/.test(raw)) {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), spaNumericRoutes()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/movie': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/subtitles': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
