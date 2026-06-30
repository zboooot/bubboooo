import { APP_VERSION } from './config.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './config.js';
import { BalloonGameApp } from './BalloonGameApp.js';
import { DebugPanelController } from './ui/DebugPanelController.js';

function resolveLaunchOptions() {
    const params = new URLSearchParams(window.location.search);
    const test = params.get('test');
    if (test === 'ninja_dart' || test === 'ninja') {
        return { testLevelId: 'ninja_dart' };
    }
    const level = params.get('level');
    if (level == null) return {};
    const n = Number.parseInt(level, 10);
    if (!Number.isFinite(n)) return {};
    // ?level=2 表示「第 2 关」（1-based）；?level=0 仍兼容为第 1 关
    if (n >= 1) return { startLevel: n - 1 };
    if (n === 0) return { startLevel: 0 };
    return {};
}

const canvas = document.getElementById('physicsCanvas');
const versionTagEl = document.getElementById('versionTag');

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
    btnOpenTestLab: document.getElementById('btnOpenTestLab'),
    btnRestartNormalGame: document.getElementById('btnRestartNormalGame'),
};

const app = new BalloonGameApp(dom, resolveLaunchOptions());
new DebugPanelController(app);
app.start();