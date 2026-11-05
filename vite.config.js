import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' lets the same build work on GitHub Pages, Cloudflare Pages, Netlify, Vercel…
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
