import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import http from 'node:http'
import https from 'node:https'

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
        let upstreamUrl: URL
        try {
          upstreamUrl = new URL(target)
        } catch {
          res.statusCode = 400
          res.end('Invalid "url" query parameter')
          return
        }
        // Use the built-in http/https modules (not global fetch) so https
        // endpoints with self-signed or otherwise invalid certificates still
        // work in dev — `rejectUnauthorized: false` mirrors the /api proxy's
        // `secure: false`. fetch (undici) has no easy per-request opt-out.
        const client = upstreamUrl.protocol === 'https:' ? https : http
        const upstreamReq = client.request(
          upstreamUrl,
          { method: 'GET', headers: { accept: 'application/json' }, rejectUnauthorized: false },
          (upstream) => {
            res.statusCode = upstream.statusCode ?? 502
            res.setHeader(
              'content-type',
              upstream.headers['content-type'] ?? 'application/json',
            )
            res.setHeader('access-control-allow-origin', '*')
            upstream.pipe(res)
          },
        )
        upstreamReq.on('error', (err: unknown) => {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        })
        upstreamReq.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // basicSsl() serves the dev server over HTTPS with a self-signed cert
  // (auto-generated). The browser will warn once about the untrusted cert —
  // accept it to proceed.
  plugins: [react(), tailwindcss(), devCorsProxy(), basicSsl()],
  server: {
    // Same-origin proxy for the app's API. The browser blocks direct
    // cross-origin calls to api.ecmplus.org because it sends no CORS headers
    // for our dev origin. Vite forwards `/api/*` to the API server-side, where
    // CORS doesn't apply, and relays the response. The client uses a relative
    // `/api` base in dev (VITE_API_BASE=/api) so requests stay same-origin.
    proxy: {
      '/api': {
        target: 'https://api.ecmplus.org',
        changeOrigin: true,
        // The API may use a self-signed/invalid cert in dev — don't reject it.
        secure: false,
      },
    },
  },
})
