import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser (~1.5 MB) is a single monolithic package that can't be split
    // further; it and the three.js ecosystem are lazy-loaded, per-route
    // vendor chunks below. The default 500 kB warn is just noise for chunks
    // we intend to be big, so raise it above Phaser's size.
    chunkSizeWarningLimit: 1550,
    rollupOptions: {
      output: {
        // Isolate the heavy, rarely-changing vendor libraries into their own
        // stably-hashed chunks. The point is caching: a gameplay tweak now
        // only invalidates the small game-code chunk, so returning players
        // re-download ~0.5 MB instead of Phaser's ~1.1 MB every deploy. Order
        // matters - @react-three matches the `three` branch before `react`.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('phaser')) return 'phaser';
          if (id.includes('three') || id.includes('postprocessing')) return 'three';
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/react-router') ||
            id.includes('/scheduler/')
          ) return 'react-vendor';
        },
      },
    },
  },
})
