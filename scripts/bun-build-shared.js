// Shared Bun.build plugin/helpers used by both scripts/bun-build.js (one-shot
// production builds) and scripts/bun-dev.js (dev server with live reload).
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import path from 'path';
import fs from 'fs/promises';

const DATA_URI_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

// Inlines local raster-image url() references as base64 data URIs, mirroring
// webpack's asset/inline rule (Bun's own CSS asset pipeline only rewrites
// url()s when Bun.build is given a writable outdir, which we bypass here).
async function inlineCssImageUrls(css, fromFile) {
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/g;
  const matches = [...css.matchAll(urlPattern)];
  let result = css;
  for (const match of matches) {
    const [full, , ref] = match;
    if (/^(data:|https?:|\/)/.test(ref)) continue;
    const ext = path.extname(ref).toLowerCase();
    const mime = DATA_URI_MIME[ext];
    if (!mime) continue;
    const assetPath = path.resolve(path.dirname(fromFile), ref);
    const data = await fs.readFile(assetPath);
    result = result.replace(full, `url("data:${mime};base64,${data.toString('base64')}")`);
  }
  return result;
}

export const tailwindPlugin = {
  name: 'tailwind-postcss',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = await fs.readFile(args.path, 'utf8');
      const result = await postcss([tailwind()]).process(source, { from: args.path });
      const inlined = await inlineCssImageUrls(result.css, args.path);
      return { contents: inlined, loader: 'css' };
    });
  },
};

async function findNearestPackageJson(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Only Node-builtin-like bare specifiers are ever remapped via a package.json
// `"browser"` field in practice. Matching onResolve this narrowly (instead of
// /.*/, i.e. every module resolution in the whole graph) matters for
// correctness, not just performance: an onResolve filter that intercepts
// every resolution was observed to corrupt Bun's minifier output for an
// unrelated module elsewhere in the bundle (a real Bun bug) even when it
// returns undefined (no override) for nearly all of them. Scoping the filter
// down to the small set of specifiers we actually care about avoids it.
const NODE_BUILTIN_LIKE = /^(node:)?(crypto|stream|buffer|vm|fs|path|url|assert|util|zlib|os|events)$/;

// Unlike webpack/esbuild/Rollup, Bun.build doesn't honor a dependency's own
// package.json `"browser"` field remapping (e.g. bcryptjs/crypto-js both ship
// `"browser": {"crypto": false}` to opt out of Node's crypto module in favor
// of the Web Crypto API). Without this, Bun falls back to bundling its own
// full node:crypto browser shim (elliptic curves, DH, RSA signing, ~550KB)
// even though nothing in the app actually needs it.
//
// This plugin re-implements that convention generically. Each stub is
// materialized as its own real file on disk rather than served through
// Bun.build's onLoad-virtual-module namespace mechanism — reusing (or even
// just namespacing) a single virtual module across two distinct importers
// was also observed to corrupt the minifier. Distinct real files avoid it.
export function browserFieldFalsePlugin(stubDir) {
  return {
    name: 'browser-field-false',
    async setup(build) {
      await fs.mkdir(stubDir, { recursive: true });
      const written = new Set();

      build.onResolve({ filter: NODE_BUILTIN_LIKE }, async (args) => {
        if (!args.importer.includes('node_modules')) return;
        const pkgPath = await findNearestPackageJson(path.dirname(args.importer));
        if (!pkgPath) return;
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
        if (!pkg.browser || pkg.browser[args.path] !== false) return;

        const stubName = `${pkg.name}__${args.path}`.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.js';
        const stubPath = path.join(stubDir, stubName);
        if (!written.has(stubPath)) {
          await fs.writeFile(stubPath, 'module.exports = {};\n');
          written.add(stubPath);
        }
        return { path: stubPath };
      });
    },
  };
}

export const ASSET_LOADERS = {
  '.svg': 'text',
  '.png': 'dataurl',
  '.jpg': 'dataurl',
  '.jpeg': 'dataurl',
  '.gif': 'dataurl',
};

export async function buildFaviconDataUri(root) {
  const svgRaw = await fs.readFile(path.join(root, 'public/favicon.svg'), 'utf8');
  const collapsed = svgRaw
    .replace(/\s*<!--[\s\S]*?-->\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return 'data:image/svg+xml,' + encodeURIComponent(collapsed);
}

export function faviconLinks(faviconDataUri) {
  return faviconDataUri
    ? `<link rel="icon" href="${faviconDataUri}">`
    : [
      '<link rel="icon" type="image/svg+xml" href="favicon.svg">',
      '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">',
      '<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">',
      '<link rel="apple-touch-icon" sizes="192x192" href="favicon-192.png">',
    ].join('\n    ');
}
