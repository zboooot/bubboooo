import * as Config from './config.js';
import { TUTORIAL_LEVELS } from './level/levelData.js';
import { createSfxSystem } from './audio/SfxSystem.js';
import { LevelService } from './level/LevelService.js';
import { BalloonService } from './entities/BalloonService.js';
import { PumpService } from './systems/PumpService.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { GameFlowService } from './game/GameFlowService.js';
import { Renderer } from './render/Renderer.js';
import { InputController } from './input/InputController.js';
import { ProgressStore } from './ui/ProgressStore.js';
import { PauseController } from './ui/PauseController.js';
import { ItemService } from './items/ItemService.js';
import { ClownPopCinematicService } from './items/ClownPopCinematicService.js';
import { TetrisWallService } from './items/TetrisWallService.js';

/**
 * 游戏主应用：持有全局状态，组装各子系统，驱动主循环。
 * 子系统通过 game 引用访问共享状态；所有子系统方法扁平挂载到 game 以兼容原有函数互调。
 */
export class BalloonGameApp {
    constructor(dom, opts = {}) {
        this.dom = dom;
        this._startLevelOverride = opts.startLevel;
        /** @type {string|null} 独立测试关 id，非空时不写入主线存档 */
        this.testLevelId = opts.testLevelId ?? null;

        // --- 可变游戏状态（与原单文件全局变量一一对应）---
        this.baselineReferenceCount = 0;
        this.baselineLevelOneCount = 0;
        this.currentLevelSpec = null;
        this.levelSpawnRng = null;
        this.levelIndex = 0;
        this.appScreen = 'game';
        this.gameOutcome = 'playing';
        this.loseCountdown = null;
        this.winRevealCountdown = null;
        this.levelTransitionCountdown = null;
        this.pendingLoadLevelIndex = 0;
        this.transitionFade = 0;
        this.levelTransitionDidLoad = false;
        this.settlementButtons = { next: null, restart: null };
        this.activeTeams = TUTORIAL_LEVELS[0].activeTeams.slice();
        this.selectedPumpIndex = 0;
        this.pumpFuelRemaining = [];
        /** @type {number[]} 气筒数字缩放（打气减少时收缩再回弹） */
        this.pumpFuelLabelScale = [];
        this.pumpHitRects = [];
        this.particles = [];
        this.constraints = [];
        this.balls = [];
        this.popEffects = [];
        this.celebrateEffects = [];
        this.winCelebrateSpawned = false;
        this.chainPopQueue = [];
        this.chainPopVisited = null;
        this.chainPopAccum = 0;
        this.chainComboCount = 0;
        this.comboHideTimer = 0;
        this.inflatePumpActive = false;
        this.outcomeSoundPlayed = null;
        this.collisionOrderFlip = false;
        this.collisionPhase = 0;
        this.constraintOrderFlip = false;
        this.simTime = 0;
        this.dragNode = null;
        this.pendingDragParticle = null;
        this.activeInflateBall = null;
        this.pointerDown = false;
        this.pointerDownPos = { x: 0, y: 0 };
        this.mouse = { x: 0, y: 0 };
        /** @type {import('./items/Item.js').Item[]} 场上道具（由 ItemService 管理，此处保留快捷引用） */
        this.itemPickups = [];
        /** @type {import('./items/NinjaDart.js').NinjaDart[]} */
        this.ninjaDarts = [];
        /** 爆炸类道具暗屏揭晓中（连锁/物理仍运行） */
        this.itemRevealActive = false;
        /** 爆破点停留中：冻结连锁、物理与操作 */
        this.itemRevealAnchorHold = false;
        /** @type {import('./level/testLabLevel.js').DEFAULT_TEST_LAB | null} */
        this.lastTestLabParams = null;
        this.clownCinematic = null;
        this.clownBurstSpawn = null;
        this.tetrisWalls = [];

        // --- 子系统实例 ---
        this.sfxEngine = createSfxSystem(() => this.simTime);
        this.sfx = this.sfxEngine;

        this.levelService = new LevelService(this);
        this.balloonService = new BalloonService(this);
        this.pumpService = new PumpService(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.gameFlow = new GameFlowService(this);
        this.renderer = new Renderer(this);
        this.input = new InputController(this);
        this.progress = new ProgressStore(this);
        this.pause = new PauseController(this);
        this.items = new ItemService(this);
        this.itemPickups = this.items.itemPickups;
        this.ninjaDarts = this.items.ninjaDarts;
        this.clownCinematicService = new ClownPopCinematicService(this);
        this.tetrisWallService = new TetrisWallService(this);

        this._wireSubsystemMethods();

        this._initBackgroundCanvas();
        this._bindEvents();
        if (this.testLevelId) {
            this.bootstrapTestLevel(this.testLevelId);
        } else {
            const save = this.loadProgress();
            const initialLevel = this._startLevelOverride ?? (save ? save.levelIndex : 0);
            this.bootstrapGame(initialLevel);
        }
        this.pumpService.layoutPumpHitRects();
    }

    /** 将各子系统 public 方法扁平挂载到 game，保持与原单文件函数互调一致 */
    _wireSubsystemMethods() {
        const services = [
            this.levelService,
            this.balloonService,
            this.pumpService,
            this.physicsEngine,
            this.gameFlow,
            this.renderer,
            this.input,
            this.progress,
            this.pause,
            this.items,
            this.clownCinematicService,
            this.tetrisWallService,
        ];
        for (const svc of services) {
            const proto = Object.getPrototypeOf(svc);
            for (const name of Object.getOwnPropertyNames(proto)) {
                if (name === 'constructor' || typeof svc[name] !== 'function') continue;
                this[name] = svc[name].bind(svc);
            }
        }
    }

    _initBackgroundCanvas() {
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = Config.width;
        this.bgCanvas.height = Config.height;
        this.bgCtx = this.bgCanvas.getContext('2d');
        const g = this.bgCtx.createLinearGradient(0, 0, 0, Config.height);
        g.addColorStop(0, '#2a1f4e');
        g.addColorStop(0.45, '#1a1a2e');
        g.addColorStop(1, '#12121f');
        this.bgCtx.fillStyle = g;
        this.bgCtx.fillRect(0, 0, Config.width, Config.height);
        this.bgCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 24; i++) {
            const sx = (i * 97) % Config.width;
            const sy = (i * 131) % Config.height;
            this.bgCtx.beginPath();
            this.bgCtx.arc(sx, sy, 1.2, 0, Math.PI * 2);
            this.bgCtx.fill();
        }
    }

    _bindEvents() {
        const { dom } = this;
        if (dom.btnStartPrimary) {
            dom.btnStartPrimary.addEventListener('click', () => this.resumeGame());
        }
        if (dom.btnStartRestart) {
            dom.btnStartRestart.addEventListener('click', () => this.restartFromPause());
        }
        if (dom.stageEl) {
            dom.stageEl.addEventListener('pointerdown', () => {
                if (this.appScreen === 'game') this.sfx.resume();
            }, { passive: true });
        }
        window.addEventListener('keydown', () => {
            if (this.appScreen === 'game') this.sfx.resume();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.togglePause();
                return;
            }
            if (this.appScreen !== 'game') return;
            if (e.key === 'r' || e.key === 'R') {
                if (this.gameOutcome === 'transition') return;
                this.scheduleLoadLevel(this.levelIndex);
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.appScreen === 'game' && this.gameOutcome === 'playing') {
                    this.showPauseScreen();
                }
            }
        });

        dom.canvas.addEventListener('mousedown', (e) => this.startDrag(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => this.moveDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this.endDrag());
        dom.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length) this.moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        window.addEventListener('touchend', () => this.endDrag());
    }

    loop() {
        if (this.appScreen === 'game') {
            this.simTime += Config.dt;
            this.updateClownPopCinematic();
            this.updateClownBurstSpawn();
            this.updateBalloonSpawnGrows();
            this.updateItems(Config.dt);

            const anchorHold = this.itemRevealAnchorHold;
            const clownFrozen =
                typeof this.isGameplayFrozen === 'function' && this.isGameplayFrozen();

            if (!this.itemRevealActive && !anchorHold && !clownFrozen) {
                this.updateInflation();
                const pumpInflate = this.activeInflateBall && this.balls.includes(this.activeInflateBall)
                    ? this.activeInflateBall.inflate
                    : 0;
                this.sfx.updatePump(pumpInflate, Config.dt, this.inflatePumpActive);
                this.updateLevelTransition();
            }

            if (!anchorHold && !clownFrozen) {
                this.updateBallLabelAnims();
                this.updatePumpFuelLabelAnims();
                this.updatePumpFuelLabelAnims();
                this.updateComboHud();
                this.updateImminentPops();
                this.processChainPops();
                this.updatePhysics();
                this.checkLevelLose();
                this.updateLoseCountdown();
                this.updateWinRevealCountdown();
                this.updatePopEffects();
            }
            this.updateCelebrateEffects();
        }
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    start() {
        this.loop();
    }
}