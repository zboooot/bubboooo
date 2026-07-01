#!/usr/bin/env node
/**
 * 打包单文件 HTML → releases/vX.Y/
 * - index.html：内联 esbuild bundle（无测试侧边栏）
 * - assets/：复制运行时依赖资源（与 index.html 同目录，可单独部署本文件夹）
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** 与 Renderer / SfxSystem 引用保持一致；缺任一文件则构建失败 */
const RELEASE_ASSETS = [
    'bgm.mp3',
    'clown.png',
    'clown_reveal.png',
    'luck.png',
    'ninja_dart_fly.mp3',
    'ninja_shout.mp3',
];

const configText = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
const versionMatch = configText.match(/export const APP_VERSION = '([^']+)'/);
const version = versionMatch?.[1] ?? '0.0';
const outDir = path.join(root, 'releases', `v${version}`);
const outHtml = path.join(outDir, 'index.html');
const outAssetsDir = path.join(outDir, 'assets');
const bundleTmp = path.join(outDir, '.bundle.tmp.js');
const assetsSrcDir = path.join(root, 'assets');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(outAssetsDir, { recursive: true });

const missing = [];
for (const file of RELEASE_ASSETS) {
    const src = path.join(assetsSrcDir, file);
    const dest = path.join(outAssetsDir, file);
    if (!fs.existsSync(src)) {
        missing.push(file);
        continue;
    }
    fs.copyFileSync(src, dest);
}
if (missing.length) {
    console.error('Missing source assets:', missing.join(', '));
    console.error(`Expected under ${assetsSrcDir}`);
    process.exit(1);
}

execFileSync(
    'npx',
    [
        'esbuild',
        path.join(root, 'js/main.release.js'),
        '--bundle',
        '--format=iife',
        '--target=es2020',
        `--outfile=${bundleTmp}`,
        '--log-level=warning',
    ],
    { cwd: root, stdio: 'inherit' },
);

let js = fs.readFileSync(bundleTmp, 'utf8');
fs.unlinkSync(bundleTmp);

/** 发布页与 assets/ 同目录 */
js = js.replace(/ASSET_ROOT = "assets\/"/g, 'ASSET_ROOT = "assets/"');
js = js.replace(/ASSET_ROOT = "\.\.\/\.\.\/assets\/"/g, 'ASSET_ROOT = "assets/"');
for (const file of RELEASE_ASSETS) {
    js = js.replaceAll(`../../assets/${file}`, `assets/${file}`);
}

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<title>[^<]*<\/title>/, `<title>气球雨 · 9:20 · v${version}</title>`);

html = html.replace(
    /#viewport \{[^}]+\}/,
    `#viewport {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0;
            padding: 12px;
            background:
                radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 107, 157, 0.12), transparent),
                radial-gradient(ellipse 60% 40% at 80% 100%, rgba(0, 243, 255, 0.08), transparent),
                var(--bg-outer);
        }`,
);

html = html.replace(
    /\n        #debugPanel \{[\s\S]*?        @media \(max-width: 520px\) \{[\s\S]*?        \}\n/,
    '\n',
);
html = html.replace(
    /\n            #viewport \{\n                gap: 0;\n            \}\n        \}\n(?=\s*<\/style>)/,
    '\n',
);

html = html.replace(
    /\s*<aside id="debugPanel"[\s\S]*?<\/aside>\s*/,
    '\n',
);

html = html.replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    `<script>\n${js}\n</script>`,
);

fs.writeFileSync(outHtml, html, 'utf8');

console.log(`Wrote ${outHtml} (${(fs.statSync(outHtml).size / 1024).toFixed(1)} KB)`);
console.log(`Copied ${RELEASE_ASSETS.length} assets → ${outAssetsDir}`);
for (const file of RELEASE_ASSETS) {
    const dest = path.join(outAssetsDir, file);
    console.log(`  · ${file} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
}