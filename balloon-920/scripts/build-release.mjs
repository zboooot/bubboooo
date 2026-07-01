#!/usr/bin/env node
/**
 * 打包为单个 index.html（JS 内联 + 资源 data URL）
 * 输出：releases/vX.Y/index.html（无外部 assets 依赖）
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** 与 Renderer / SfxSystem 引用保持一致；缺任一文件则构建失败 */
const RELEASE_ASSETS = [
    { file: 'bgm.mp3', mime: 'audio/mpeg' },
    { file: 'clown.png', mime: 'image/png' },
    { file: 'clown_reveal.png', mime: 'image/png' },
    { file: 'luck.png', mime: 'image/png' },
    { file: 'ninja_dart_fly.mp3', mime: 'audio/mpeg' },
    { file: 'ninja_shout.mp3', mime: 'audio/mpeg' },
];

const configText = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
const versionMatch = configText.match(/export const APP_VERSION = '([^']+)'/);
const version = versionMatch?.[1] ?? '0.0';
const outDir = path.join(root, 'releases', `v${version}`);
const outHtml = path.join(outDir, 'index.html');
const bundleTmp = path.join(outDir, '.bundle.tmp.js');
const assetsSrcDir = path.join(root, 'assets');

fs.mkdirSync(outDir, { recursive: true });

/** @type {Record<string, string>} */
const dataUrls = {};
const missing = [];
for (const { file, mime } of RELEASE_ASSETS) {
    const src = path.join(assetsSrcDir, file);
    if (!fs.existsSync(src)) {
        missing.push(file);
        continue;
    }
    const b64 = fs.readFileSync(src).toString('base64');
    dataUrls[file] = `data:${mime};base64,${b64}`;
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

js = js.replace(/const BGM_SRC = "[^"]*"/, `const BGM_SRC = ${JSON.stringify(dataUrls['bgm.mp3'])}`);
js = js.replace(/const NINJA_SHOUT_SRC = "[^"]*"/, `const NINJA_SHOUT_SRC = ${JSON.stringify(dataUrls['ninja_shout.mp3'])}`);
js = js.replace(/const NINJA_DART_FLY_SRC = "[^"]*"/, `const NINJA_DART_FLY_SRC = ${JSON.stringify(dataUrls['ninja_dart_fly.mp3'])}`);

js = js.replace(/var ASSET_ROOT = "[^"]*"/, 'var ASSET_ROOT = ""');
js = js.replace(
    /var CLOWN_ICON_FILE = "clown\.png"/,
    `var CLOWN_ICON_FILE = ${JSON.stringify(dataUrls['clown.png'])}`,
);
js = js.replace(
    /var CLOWN_REVEAL_ICON_FILE = "clown_reveal\.png"/,
    `var CLOWN_REVEAL_ICON_FILE = ${JSON.stringify(dataUrls['clown_reveal.png'])}`,
);
js = js.replace(
    /this\.luckIconImage\.src = `\$\{ASSET_ROOT\}luck\.png`/g,
    `this.luckIconImage.src = ${JSON.stringify(dataUrls['luck.png'])}`,
);
js = js.replace(
    /this\.clownIconImage\.src = `\$\{ASSET_ROOT\}\$\{CLOWN_ICON_FILE\}`;/g,
    'this.clownIconImage.src = CLOWN_ICON_FILE;',
);
js = js.replace(
    /this\.clownRevealIconImage\.src = `\$\{ASSET_ROOT\}\$\{CLOWN_REVEAL_ICON_FILE\}`;/g,
    'this.clownRevealIconImage.src = CLOWN_REVEAL_ICON_FILE;',
);

for (const { file } of RELEASE_ASSETS) {
    js = js.replaceAll(`../../assets/${file}`, dataUrls[file]);
    js = js.replaceAll(`assets/${file}`, dataUrls[file]);
}

const leakPatterns = [
    /ASSET_ROOT = "\.\.\//,
    /\$\{ASSET_ROOT\}/,
    /const BGM_SRC = "assets\//,
    /fetch\("assets\//,
    /\.src = "assets\//,
];
for (const re of leakPatterns) {
    if (re.test(js)) {
        console.error('Bundle still references external assets:', re);
        process.exit(1);
    }
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

const htmlKb = fs.statSync(outHtml).size / 1024;
console.log(`Wrote ${outHtml} (${htmlKb.toFixed(1)} KB, single-file)`);
console.log('Embedded assets:');
for (const { file } of RELEASE_ASSETS) {
    const raw = fs.statSync(path.join(assetsSrcDir, file)).size;
    console.log(`  · ${file} (${(raw / 1024).toFixed(1)} KB raw → data URL)`);
}