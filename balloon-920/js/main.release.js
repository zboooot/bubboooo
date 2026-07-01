import { APP_VERSION } from './config.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './config.js';
import { BalloonGameApp } from './BalloonGameApp.js';

function resolveLaunchOptions() {
    const params = new URLSearchParams(window.location.search);
    const level = params.get('level');
    if (level == null) return {};
    const n = Number.parseInt(level, 10);
    if (!Number.isFinite(n)) return {};
    if (n >= 1) return { startLevel: n - 1 };
    if (n === 0) return { startLevel: 0 };
    return {};
}

const canvas = document.getElementById('physicsCanvas');
const versionTagEl = document.getElementById('versionTag');

if (!canvas) {
    throw new Error('缺少 #physicsCanvas，请通过 HTTP 打开游戏页面');
}

canvas.width = LOGICAL_WIDTH;
canvas.height = LOGICAL_HEIGHT;
if (versionTagEl) versionTagEl.textContent = `v${APP_VERSION}`;

const dom = {
    canvas,
    ctx: canvas.getContext('2d'),
    ballCountEl: document.getElementById('ballCount'),
    levelHudEl: document.getElementById('levelHud'),
    comboHudEl: document.getElementById('comboHud'),
    comboValueEl: document.getElementById('comboValue'),
    versionTagEl,
    startScreenEl: document.getElementById('startScreen'),
    btnStartPrimary: document.getElementById('btnStartPrimary'),
    btnStartRestart: document.getElementById('btnStartRestart'),
    stageEl: document.getElementById('stage'),
    btnOpenTestLab: null,
    btnRestartNormalGame: null,
};

const app = new BalloonGameApp(dom, resolveLaunchOptions());
app.start();