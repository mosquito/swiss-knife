#!/usr/bin/env bun
// Bun-native replacement for webpack.config.js / webpack.offline.config.js.
// Usage: bun scripts/bun-build.js <web|offline>
import path from 'path';
import fs from 'fs/promises';
import { tailwindPlugin, browserFieldFalsePlugin, ASSET_LOADERS, buildFaviconDataUri, faviconLinks } from './bun-build-shared.js';

const mode = process.argv[2];
if (!['web', 'offline'].includes(mode)) {
  console.error('Usage: bun scripts/bun-build.js <web|offline>');
  process.exit(1);
}

const root = path.resolve(import.meta.dir, '..');
const outdir = path.join(root, mode === 'web' ? 'dist' : 'dist-offline');

const CSP = mode === 'web'
  ? "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none';"
  : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none';";

function htmlHead({ faviconDataUri }) {
  return `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <title>Browser Toolkit</title>
    ${faviconLinks(faviconDataUri)}`;
}

await fs.rm(outdir, { recursive: true, force: true });
await fs.mkdir(outdir, { recursive: true });

const result = await Bun.build({
  entrypoints: [path.join(root, 'src/index.js')],
  target: 'browser',
  minify: true,
  plugins: [browserFieldFalsePlugin(path.join(root, 'node_modules/.cache/bun-build-stubs')), tailwindPlugin],
  loader: ASSET_LOADERS,
  naming: { entry: '[dir]/bundle.[ext]' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const js = result.outputs.find((o) => o.kind === 'entry-point');
const css = result.outputs.find((o) => o.type?.startsWith('text/css'));

if (mode === 'web') {
  await fs.writeFile(path.join(outdir, 'bundle.js'), await js.text());
  if (css) await fs.writeFile(path.join(outdir, 'bundle.css'), await css.text());
  await fs.copyFile(path.join(root, 'public/favicon.svg'), path.join(outdir, 'favicon.svg'));

  const cssLink = css ? '<link rel="stylesheet" href="bundle.css">' : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    ${htmlHead({ faviconDataUri: null })}
    ${cssLink}
</head>
<body>
    <div id="root"></div>
    <script src="bundle.js"></script>
</body>
</html>`;
  await fs.writeFile(path.join(outdir, 'index.html'), html);
} else {
  const faviconDataUri = await buildFaviconDataUri(root);
  // Escape sequences that would let the HTML tokenizer terminate the inline
  // <script>/<style> early (e.g. React's own `"<script></script>"` string).
  const jsText = (await js.text()).replace(/<\/script/gi, '<\\/script');
  const cssText = (css ? await css.text() : '').replace(/<\/style/gi, '<\\/style');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    ${htmlHead({ faviconDataUri })}
    ${cssText ? `<style>${cssText}</style>` : ''}
</head>
<body>
    <div id="root"></div>
    <script>${jsText}</script>
</body>
</html>`;
  await fs.writeFile(path.join(outdir, 'index.html'), html);
}

console.log(`Built ${mode} -> ${path.relative(root, outdir)}/`);
