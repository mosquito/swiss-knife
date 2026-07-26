#!/usr/bin/env bun
// Bun-native replacement for webpack-dev-server (webpack.config.js devServer).
// Rebuilds in-memory on src changes and pushes a live-reload signal over a
// WebSocket, mirroring the *full-reload* behavior the current webpack config
// actually gets (no react-refresh plugin is configured, so `hot: true` there
// already just triggers a full page reload rather than true state-preserving HMR).
import path from 'path';
import { watch } from 'fs';
import { tailwindPlugin, browserFieldFalsePlugin, ASSET_LOADERS, faviconLinks } from './bun-build-shared.js';

const root = path.resolve(import.meta.dir, '..');
const PORT = 3000;

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:*; frame-src 'none'; object-src 'none';";

let js = '';
let css = '';
let buildError = null;
const sockets = new Set();

async function build() {
  const start = performance.now();
  const result = await Bun.build({
    entrypoints: [path.join(root, 'src/index.js')],
    target: 'browser',
    minify: true,
    sourcemap: 'inline',
    plugins: [browserFieldFalsePlugin(path.join(root, 'node_modules/.cache/bun-build-stubs')), tailwindPlugin],
    loader: ASSET_LOADERS,
    naming: { entry: '[dir]/bundle.[ext]' },
  });

  if (!result.success) {
    buildError = result.logs.map(String).join('\n');
    console.error('Build failed:\n' + buildError);
    return false;
  }

  buildError = null;
  const jsOut = result.outputs.find((o) => o.kind === 'entry-point');
  const cssOut = result.outputs.find((o) => o.type?.startsWith('text/css'));
  js = await jsOut.text();
  css = cssOut ? await cssOut.text() : '';
  console.log(`Rebuilt in ${(performance.now() - start).toFixed(0)}ms`);
  return true;
}

function page() {
  if (buildError) {
    return `<!DOCTYPE html><html><body><pre style="color:red;white-space:pre-wrap">${
      buildError.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    }</pre></body></html>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <title>Browser Toolkit</title>
    ${faviconLinks(null)}
    <style>${css}</style>
</head>
<body>
    <div id="root"></div>
    <script src="/bundle.js"></script>
    <script>
      (function() {
        const ws = new WebSocket('ws://' + location.host + '/__dev_ws');
        ws.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
        ws.onclose = () => setTimeout(() => location.reload(), 1000);
      })();
    </script>
</body>
</html>`;
}

let rebuildTimer = null;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    await build();
    for (const ws of sockets) ws.send('reload');
  }, 100);
}

await build();

const srcWatcher = watch(path.join(root, 'src'), { recursive: true }, scheduleRebuild);
const publicWatcher = watch(path.join(root, 'public'), { recursive: true }, scheduleRebuild);

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/__dev_ws') {
      if (server.upgrade(req)) return;
      return new Response('Upgrade failed', { status: 500 });
    }
    if (url.pathname === '/bundle.js') {
      return new Response(js, { headers: { 'Content-Type': 'text/javascript' } });
    }
    if (url.pathname === '/favicon.svg') {
      return new Response(Bun.file(path.join(root, 'public/favicon.svg')));
    }
    return new Response(page(), { headers: { 'Content-Type': 'text/html' } });
  },
  websocket: {
    open(ws) { sockets.add(ws); },
    close(ws) { sockets.delete(ws); },
    message() {},
  },
});

console.log(`Dev server running at http://localhost:${server.port}`);

process.on('SIGINT', () => {
  srcWatcher.close();
  publicWatcher.close();
  process.exit(0);
});
