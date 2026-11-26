import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

const APP_VERSION = '1.1.0';

function resolveShortBuildCommit(): string {
  const fromEnv = (
    process.env.VITE_BUILD_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    ''
  ).trim();
  if (fromEnv.length >= 7) {
    return fromEnv.slice(0, 7);
  }
  try {
    const out = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (out) return out.slice(0, 12);
  } catch {
    // Fallback when building outside a git checkout
  }
  return 'local';
}

function createStampPwaSwPlugin(swVersion: string): Plugin {
  return {
    name: 'stamp-pwa-service-worker',
    closeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (!fs.existsSync(distSwPath)) return;
      const content = fs.readFileSync(distSwPath, 'utf8');
      const stamped = content.replace(/__SW_VERSION__/g, swVersion);
      fs.writeFileSync(distSwPath, stamped, 'utf8');
    },
  };
}

export default defineConfig(() => {
  const buildCommit = resolveShortBuildCommit();
  const buildTime = new Date().toISOString().replace(/[:.]/g, '-');
  const swVersion = `v${APP_VERSION}-${buildCommit}-${buildTime}`;

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __BUILD_COMMIT__: JSON.stringify(buildCommit),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [react(), tailwindcss(), createStampPwaSwPlugin(swVersion)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
            if (
              id.includes('src/game/extraPlayers') ||
              id.includes('src/data/players.json') ||
              id.includes('src/game/minigamesData')
            ) {
              return 'game-data';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
