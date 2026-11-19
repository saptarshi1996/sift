import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/, so the deploy sets BASE_PATH. Locally it is '/'.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
