import { federation } from '@module-federation/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite build` builds the Cloud Run client (unchanged). `vite build --mode remote` builds the Module Federation
// remote for nakomis-shell (app.{env}/remotes/status/, exposing ./App) into dist-remote/.
export default defineConfig(({ mode }) => {
  const remote = mode === 'remote'
  return {
    base: remote ? '/remotes/status/' : '/',
    plugins: [
      react(),
      ...(remote
        ? [
            federation({
              name: 'status',
              filename: 'remoteEntry.js',
              exposes: { './App': './src/ShellApp.tsx' },
              shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
              dts: false,
            }),
          ]
        : []),
    ],
    build: { outDir: remote ? 'dist-remote' : 'dist' },
    server: {
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
      exclude: ['**/node_modules/**', '**/dist/**', '**/dist-server/**', '**/dist-remote/**'],
    },
  }
})
