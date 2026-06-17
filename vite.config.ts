import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only proxy for the form designer's "options from API" feature. Browsers
// block cross-origin fetches to third-party APIs that don't send CORS headers
// (e.g. jsonplaceholder). In dev we forward `GET /__cors?url=<encoded>` to the
// target server-side (no CORS between Node and the API) and relay the response
// with a permissive CORS header. The client routes absolute option URLs through
// here in dev — see src/forms/fields/useChoiceOptions.ts.
//
// NOTE: this lives only in the dev server. In production the target API must
// itself allow CORS, or be reached same-origin (e.g. via the /api proxy below).
function devCorsProxy(): Plugin {
  return {
    name: 'dev-cors-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/__cors')) return next()
        const target = new URL(req.url, 'http://localhost').searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.end('Missing "url" query parameter')
          return
        }
        fetch(target, { headers: { accept: 'application/json' } })
          .then(async (upstream) => {
            const body = Buffer.from(await upstream.arrayBuffer())
            res.statusCode = upstream.status
            res.setHeader(
              'content-type',
              upstream.headers.get('content-type') ?? 'application/json',
            )
            res.setHeader('access-control-allow-origin', '*')
            res.end(body)
          })
          .catch((err: unknown) => {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devCorsProxy()],
  server: {
    // The EcmPlus dev API sends no Access-Control-Allow-Origin header, so a
    // direct browser fetch from the Vite origin is blocked by CORS. Proxy
    // /api through the dev server (same-origin to the browser) instead.
    // Change this target if the dev API ever moves.
    proxy: {
      "/api": {
        target: "https://api.ecmplus.org",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
