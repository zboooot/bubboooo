import { APP_VERSION } from './config.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './config.js';
import { BalloonGameApp } from './BalloonGameApp.js';

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
};

const app = new BalloonGameApp(dom);
app.start();