import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // @bpmn-io/form-js-editor pins an older preact range, so npm installs a
    // second copy of preact nested under it. With two preact instances the
    // form editor's hooks resolve against the wrong renderer and crash with
    // "Cannot read properties of undefined (reading 'context')". Dedupe forces
    // a single preact instance shared with the bpmn-js properties panel.
    dedupe: ['preact'],
  },
})
