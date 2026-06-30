import * as Config from '../config.js';
import { TEAM_PALETTE, TUTORIAL_LEVEL_COUNT, TUTORIAL_LEVELS, TEST_LEVELS } from './levelData.js';
import { clamp, makeSeededRng, rollEphemeralSeed } from '../utils/math.js';
import { buildTestLabLevelSpec } from './testLabLevel.js';
import { spawnClownBalloon } from '../items/clownBalloon.js';
import { spawnRainbowBalloon } from '../items/rainbowBalloon.js';

/** LevelService */
export class LevelService {
    constructor(game) {
        this.game = game;
    }

    proceduralTier(levelIndex) {
        return levelIndex - TUTORIAL_LEVEL_COUNT + 1;
    }

    isTutorialLevel(levelIndex) {
        return levelIndex < TUTORIAL_LEVEL_COUNT;
    }

    generateProceduralLevel(levelIndex) {
        const tier = this.proceduralTier(levelIndex);
        const seed = (levelIndex + 1) * 9973 + tier * 104729;
        const rng = makeSeededRng(seed);

        const wave = Math.sin(tier * 0.85);
        const wave2 = Math.sin(tier * 1.35 + 0.4);

        const colorCount = clamp(2 + Math.floor((tier + 2) / 3), 2, TEAM_PALETTE.length);
        const activeTeams = [];
        for (let i = 0; i < colorCount; i++) activeTeams.push(i);

        const balloonCountFactor = clamp(
            1.18 + tier * 0.055 + wave * 0.11,
            1.12,
            2.35
        );
        const layoutRadiusScale = clamp(1 - tier * 0.026 - Math.max(0, wave) * 0.04, 0.55, 1);
        const scatter = clamp(0.1 + tier * 0.032 + (wave2 > 0 ? 0.1 : 0.02), 0, 0.52);
        const pumpSlack = clamp(0.1 + wave * 0.07, 0.04, 0.22);

        const scarceSlot = tier >= 2 ? Math.floor(rng() * activeTeams.length) : -1;
        const teamSpawnWeights = new Array(activeTeams.length).fill(1);
        if (scarceSlot >= 0) {
            const scarceShare = clamp(0.1 + tier * 0.012, 0.08, 0.22);
            const rest = (1 - scarceShare) / Math.max(1, activeTeams.length - 1);
            for (let s = 0; s < activeTeams.length; s++) {
                teamSpawnWeights[s] = s === scarceSlot ? scarceShare : rest;
            }
        } else {
            const even = 1 / activeTeams.length;
            for (let s = 0; s < activeTeams.length; s++) teamSpawnWeights[s] = even;
        }

        const pumpNerfBySlot = {};
        if (tier >= 3) {
            const nerfSlot = scarceSlot >= 0 ? scarceSlot : Math.floor(rng() * activeTeams.length);
            pumpNerfBySlot[nerfSlot] = clamp(0.48 + rng() * 0.12, 0.45, 0.62);
        }
        if (tier >= 6) {
            let second = Math.floor(rng() * activeTeams.length);
            while (second in pumpNerfBySlot) second = (second + 1) % activeTeams.length;
            pumpNerfBySlot[second] = clamp(0.58 + rng() * 0.12, 0.52, 0.72);
        }

        const breathLevel = wave < -0.35;
        const title = breathLevel
            ? `喘息 · ${levelIndex + 1}`
            : `征程 · ${levelIndex + 1}`;

        return {
            id: levelIndex + 1,
            title,
            procedural: true,
            seed,
            balloonCountFactor: breathLevel ? balloonCountFactor * 0.94 : balloonCountFactor,
            layoutRadiusScale,
            scatter,
            activeTeams,
            teamSpawnWeights,
            scarceSlot,
            pumpSlack: breathLevel ? pumpSlack + 0.06 : pumpSlack,
            pumpNerfBySlot
        };
    }

    getLevelSpec(levelIndex) {
        if (this.isTutorialLevel(levelIndex)) return TUTORIAL_LEVELS[levelIndex];
        return this.generateProceduralLevel(levelIndex);
    }

    getTestLevelSpec(testId) {
        return TEST_LEVELS[testId] ?? null;
    }

    isTestSession() {
        return !!this.game.testLevelId;
    }

    loadTestLevel(testId = this.game.testLevelId) {
        const game = this.game;
        const level = this.getTestLevelSpec(testId);
        if (!level) return;

        game.testLevelId = testId;
        game.currentLevelSpec = level;
        game.levelSpawnRng = makeSeededRng(919919);
        game.clearWorld();
        game.gameOutcome = 'playing';
        game.levelTransitionCountdown = null;
        game.transitionFade = 0;
        game.levelTransitionDidLoad = false;
        game.loseCountdown = null;
        game.winRevealCountdown = null;
        game.settlementButtons = { next: null, restart: null };
        game.selectedPumpIndex = 0;
        game.activeTeams = level.activeTeams.slice();
        game.layoutPumpHitRects();

        const layout = game.computeBalloonFillLayout(
            level.balloonCountFactor,
            level.layoutRadiusScale ?? 1
        );
        game.pumpFuelRemaining = level.pump.slice();
        game.resetPumpFuelLabelAnims();
        game.spawnBalloonsWithLayout(layout, level);
        game.resetOutcomeSound();
        game.updateLevelHud();
    }

    pickSpawnTeamFromWeights(level, rng) {
        const game = this.game;
            const teams = level.activeTeams;
            const weights = level.teamSpawnWeights;
            if (!weights || weights.length !== teams.length) {
                return teams[Math.floor(rng() * teams.length)];
            }
            let roll = rng();
            for (let s = 0; s < teams.length; s++) {
                roll -= weights[s];
                if (roll <= 0) return teams[s];
            }
            return teams[teams.length - 1];
    }

    buildProceduralPump(level, layout) {
        const game = this.game;
            const teams = level.activeTeams;
            const scale = layout.referenceCount > 0 ? layout.count / layout.referenceCount : 1;
            const slack = level.pumpSlack ?? 0.12;
            const pump = teams.map((ti) =>
                Math.ceil(TEAM_PALETTE[ti].defaultPump * scale * (1 + slack))
            );
            const nerfs = level.pumpNerfBySlot || {};
            for (const key of Object.keys(nerfs)) {
                const slot = Number(key);
                if (slot >= 0 && slot < pump.length) {
                    pump[slot] = Math.max(6, Math.ceil(pump[slot] * nerfs[slot]));
                }
            }
            return pump;
    }

    computeBalloonFillLayout(balloonCountFactor = 1, layoutRadiusScale = 1) {
        const game = this.game;
            const playW = Config.width - Config.BALLOON_FIELD_PAD_X * 2;
            const playH = Config.GROUND_Y - Config.BALLOON_FIELD_PAD_TOP - Config.BALLOON_FIELD_PAD_BOTTOM;
            const r = game.estimateMeanBalloonRadius() * clamp(layoutRadiusScale, 0.5, 1);
            const packGap = Config.BALLOON_PACK_GAP * clamp(0.65 + layoutRadiusScale * 0.35, 0.65, 1);
            const pitchX = 2 * r + packGap;
            const pitchY = pitchX * (Math.sqrt(3) * 0.5);

            let cols = Math.max(1, Math.floor((playW - 2 * r) / pitchX) + 1);
            let rows = Math.max(1, Math.floor((playH - 2 * r) / pitchY) + 1);

            while (cols > 1 && (cols - 1) * pitchX + 2 * r > playW + 1) cols--;
            while (rows > 1 && (rows - 1) * pitchY + 2 * r > playH + 1) rows--;

            const gridCount = cols * rows;
            const referenceCount = Math.max(
                gridCount,
                Math.round(gridCount * Config.BASELINE_SPAWN.countMultiplier)
            );
            const desiredCount = Math.max(1, Math.round(referenceCount * balloonCountFactor));
            let spawnRows = Math.ceil(desiredCount / cols);
            let count = desiredCount;
            if (balloonCountFactor <= 1) {
                spawnRows = Math.min(spawnRows, rows);
                count = Math.min(desiredCount, spawnRows * cols);
            }
            const spanX = cols > 1 ? (cols - 1) * pitchX : 0;
            const spanY = spawnRows > 1 ? (spawnRows - 1) * pitchY : 0;
            const originX = Config.BALLOON_FIELD_PAD_X + (playW - spanX) * 0.5;
            const floorLine = game.floorLimitY();
            const originY = floorLine - r - spanY;

            return {
                count,
                referenceCount,
                balloonCountFactor,
                gridCount,
                cols,
                rows: spawnRows,
                rowsInView: rows,
                r,
                pitchX,
                pitchY,
                originX,
                originY
            };
    }

    spawnBalloonsWithLayout(layout, level) {
        const game = this.game;
            const rng = game.levelSpawnRng || makeSeededRng(level.seed || 1);
            const scatter = level.scatter ?? 0;
            const radiusScale = level.layoutRadiusScale ?? 1;
            const playW = Config.width - Config.BALLOON_FIELD_PAD_X * 2;
            const playTop = Config.BALLOON_FIELD_PAD_TOP;
            const playBottom = game.floorLimitY() - layout.r;

            for (let i = 0; i < layout.count; i++) {
                const col = i % layout.cols;
                const row = Math.floor(i / layout.cols);
                const stagger = (row % 2) * (layout.pitchX * 0.5);
                let cx = layout.originX + col * layout.pitchX + stagger;
                let cy = layout.originY + row * layout.pitchY;

                if (scatter > 0.05) {
                    const ampX = layout.pitchX * scatter * 0.55;
                    const ampY = layout.pitchY * scatter * 0.5;
                    cx += (rng() - 0.5) * 2 * ampX;
                    cy += (rng() - 0.5) * 2 * ampY;
                    if (scatter > 0.28 && rng() < scatter * 0.35) {
                        cx = Config.BALLOON_FIELD_PAD_X + layout.r + rng() * (playW - 2 * layout.r);
                        cy = playTop + layout.r + rng() * Math.max(layout.r, playBottom - playTop - layout.r);
                    }
                }

                const teamId = level.procedural
                    ? game.pickSpawnTeamFromWeights(level, rng)
                    : level.activeTeams[i % level.activeTeams.length];
                const { colorBase, colorLight } = game.pickTeamColor(teamId);
                const air = game.rollBaselineInitialAir(i);
                const seedRadius = Config.MIN_BALLOON_RADIUS * radiusScale;
                game.createSoftBall(cx, cy, seedRadius, colorBase, colorLight);
                const ball = game.balls[game.balls.length - 1];
                ball.air = air;
                game.applyBallAirVisual(ball);
                const visualR = seedRadius * game.currentInflateScale(ball);
                game.reshapeBallToCircle(ball, visualR);
                game.localRelaxBall(ball, 10);
                game.syncBallRestState(ball);
                game.schedulePopIfEmpty(ball);
                ball.labelLastCeil = game.displayAirForLabel(ball);
                game.onBalloonSpawn(ball, i, level);
            }

            game.refreshBallCentroids();
            game.updateBallCount();
    }

    loadLevelImmediate(idx, duringTransition = false) {
        const game = this.game;
            if (game.testLevelId) {
                game.loadTestLevel(game.testLevelId);
                return;
            }
            game.levelIndex = Math.max(0, idx);
            const level = game.getLevelSpec(game.levelIndex);
            game.currentLevelSpec = level;
            game.levelSpawnRng = makeSeededRng(level.seed || (game.levelIndex + 1) * 131);
            game.clearWorld();
            if (!duringTransition) {
                game.gameOutcome = 'playing';
                game.levelTransitionCountdown = null;
                game.transitionFade = 0;
                game.levelTransitionDidLoad = false;
            }
            game.loseCountdown = null;
            game.winRevealCountdown = null;
            game.settlementButtons = { next: null, restart: null };
            game.selectedPumpIndex = 0;
            game.activeTeams = level.activeTeams.slice();
            game.layoutPumpHitRects();

            const layout = game.computeBalloonFillLayout(
                level.balloonCountFactor,
                level.layoutRadiusScale ?? 1
            );
            if (level.pump && level.pump.length === game.activeTeams.length) {
                game.pumpFuelRemaining = level.pump.slice();
            } else {
                game.pumpFuelRemaining = game.buildProceduralPump(level, layout);
            }
            game.resetPumpFuelLabelAnims();
            if (game.isTutorialLevel(game.levelIndex)) {
                game.captureBaselineCounts(layout);
            }
            game.spawnBalloonsWithLayout(layout, level);
            game.spawnTetrisWallsForLevel(level);
            game.resetOutcomeSound();
            game.updateLevelHud();
            if (!duringTransition && game.appScreen === 'game') game.saveProgress();
    }

    scheduleLoadLevel(idx) {
        const game = this.game;
            if (game.testLevelId) {
                game.loadTestLevel(game.testLevelId);
                return;
            }
            game.pendingLoadLevelIndex = Math.max(0, idx);
            game.levelTransitionCountdown = Config.TRANSITION_GAP_SEC;
            game.transitionFade = 0;
            game.levelTransitionDidLoad = false;
            game.gameOutcome = 'transition';
            game.settlementButtons = { next: null, restart: null };
            game.celebrateEffects.length = 0;
            game.winCelebrateSpawned = false;
            game.activeInflateBall = null;
            game.pointerDown = false;
            game.updateLevelHud();
    }

    updateLevelTransition() {
        const game = this.game;
            if (game.gameOutcome !== 'transition') return;
            if (game.levelTransitionCountdown == null) return;
            game.levelTransitionCountdown -= Config.dt;
            const elapsed = Config.TRANSITION_GAP_SEC - game.levelTransitionCountdown;
            if (elapsed < Config.TRANSITION_FADE_HALF_SEC) {
                game.transitionFade = elapsed / Config.TRANSITION_FADE_HALF_SEC;
            } else {
                if (!game.levelTransitionDidLoad) {
                    game.loadLevelImmediate(game.pendingLoadLevelIndex, true);
                    game.levelTransitionDidLoad = true;
                }
                const t = Math.min(1, (elapsed - Config.TRANSITION_FADE_HALF_SEC) / Config.TRANSITION_FADE_HALF_SEC);
                game.transitionFade = 1 - t;
            }
            game.updateLevelHud();
            if (game.levelTransitionCountdown <= 0) {
                game.levelTransitionCountdown = null;
                game.transitionFade = 0;
                game.levelTransitionDidLoad = false;
                game.gameOutcome = 'playing';
            }
    }

    captureBaselineCounts(layout) {
        const game = this.game;
            game.baselineReferenceCount = layout.referenceCount;
            if (layout.balloonCountFactor <= 1) {
                game.baselineLevelOneCount = layout.count;
            }
    }

    resolveBalloonCountFactor(factor) {
        const game = this.game;
            const ref = game.baselineReferenceCount > 0
                ? game.baselineReferenceCount
                : game.computeBalloonFillLayout(1).referenceCount;
            return Math.max(1, Math.round(ref * factor));
    }

    advanceAfterWin() {
        const game = this.game;
            if (game.testLevelId) {
                game.loadTestLevel(game.testLevelId);
                return;
            }
            game.scheduleLoadLevel(game.levelIndex + 1);
    }

    clearWorld() {
        const game = this.game;
            while (game.balls.length > 0) game.destroyBall(0);
            game.popEffects.length = 0;
            game.celebrateEffects.length = 0;
            game.winCelebrateSpawned = false;
            game.resetChainPopState();
            game.hideComboHud();
            game.activeInflateBall = null;
            game.dragNode = null;
            game.pendingDragParticle = null;
            game.clearLevelItems();
            game.clearTetrisWalls();
            game.clownCinematic = null;
            game.clownBurstSpawn = null;
    }

    estimateMeanBalloonRadius() {
        const game = this.game;
            let sumScale = 0;
            const buckets = Config.BASELINE_SPAWN.airBuckets;
            for (let i = 0; i < buckets.length; i++) {
                const mid = (buckets[i].min + buckets[i].max) * 0.5;
                sumScale += game.visualScaleFromAir(mid);
            }
            const meanScale = sumScale / buckets.length;
            return Config.MIN_BALLOON_RADIUS * meanScale;
    }

    loadTestLabLevel(params) {
        const game = this.game;
        const level = buildTestLabLevelSpec(params);
        if (level.itemMode !== 'clown' && level.itemMode !== 'both') level.clownCount = 0;
        if (level.itemMode !== 'tetris' && level.itemMode !== 'both') level.tetrisWallCount = 0;
        if (level.itemMode === 'ninja_dart') {
            level.clownCount = 0;
            level.tetrisWallCount = 0;
            level.rainbowCount = 0;
        }
        if (level.itemMode !== 'rainbow') level.rainbowCount = 0;
        game.levelIndex = 0;
        game.currentLevelSpec = level;
        level.seed = rollEphemeralSeed(0x7e57);
        game.levelSpawnRng = makeSeededRng(level.seed);
        game.clearWorld();
        game.gameOutcome = 'playing';
        game.levelTransitionCountdown = null;
        game.transitionFade = 0;
        game.loseCountdown = null;
        game.winRevealCountdown = null;
        game.settlementButtons = { next: null, restart: null };
        game.selectedPumpIndex = 0;
        game.activeTeams = level.activeTeams.slice();
        game.layoutPumpHitRects();
        game.pumpFuelRemaining = level.pump.slice();
        game.resetPumpFuelLabelAnims();
        game.spawnTestLabBalloons(level);
        game.spawnTetrisWallsForLevel(level);
        game.resetOutcomeSound();
        game.updateLevelHud();
    }

    spawnTestLabBalloons(level) {
        const game = this.game;
        const rng = game.levelSpawnRng || makeSeededRng(level.seed || 1);
        const normalCount = Math.max(0, level.balloonCount ?? 0);
        const clownCount =
            level.itemMode === 'clown' ? Math.max(0, level.clownCount ?? 0) : 0;
        const rainbowCount =
            level.itemMode === 'rainbow' ? Math.max(0, level.rainbowCount ?? 0) : 0;
        const total = Math.max(1, normalCount + clownCount + rainbowCount);
        const layout = game.computeBalloonFillLayout(1, level.layoutRadiusScale ?? 0.95);
        layout.count = total;
        const cols = layout.cols;
        const rows = Math.max(1, Math.ceil(total / cols));
        layout.rows = rows;

        const scatter = level.scatter ?? 0;
        const radiusScale = level.layoutRadiusScale ?? 1;
        const playW = Config.width - Config.BALLOON_FIELD_PAD_X * 2;
        const playTop = Config.BALLOON_FIELD_PAD_TOP;
        const playBottom = game.floorLimitY() - layout.r;
        const copyMeta = {
            copyMin: level.clownCopyMin,
            copyMax: level.clownCopyMax,
        };
        const clownSlots = new Set();
        while (clownSlots.size < clownCount && clownSlots.size < total) {
            clownSlots.add(Math.floor(rng() * total));
        }
        const rainbowSlots = new Set();
        for (let guard = 0; rainbowSlots.size < rainbowCount && guard < total * 12; guard++) {
            const slot = Math.floor(rng() * total);
            if (!clownSlots.has(slot)) rainbowSlots.add(slot);
        }

        for (let i = 0; i < total; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const stagger = (row % 2) * (layout.pitchX * 0.5);
            let cx = layout.originX + col * layout.pitchX + stagger;
            let cy = layout.originY + row * layout.pitchY;
            if (scatter > 0.05) {
                const ampX = layout.pitchX * scatter * 0.55;
                const ampY = layout.pitchY * scatter * 0.5;
                cx += (rng() - 0.5) * 2 * ampX;
                cy += (rng() - 0.5) * 2 * ampY;
                if (scatter > 0.28 && rng() < scatter * 0.35) {
                    cx = Config.BALLOON_FIELD_PAD_X + layout.r + rng() * (playW - 2 * layout.r);
                    cy = playTop + layout.r + rng() * Math.max(layout.r, playBottom - playTop - layout.r);
                }
            }

            const seedRadius = Config.MIN_BALLOON_RADIUS * radiusScale;
            if (clownSlots.has(i)) {
                spawnClownBalloon(game, cx, cy, seedRadius, copyMeta);
                const ball = game.balls[game.balls.length - 1];
                game.onBalloonSpawn(ball, i, level);
                continue;
            }
            if (rainbowSlots.has(i)) {
                spawnRainbowBalloon(game, cx, cy, seedRadius);
                const ball = game.balls[game.balls.length - 1];
                game.onBalloonSpawn(ball, i, level);
                continue;
            }

            const teamId = level.activeTeams[i % level.activeTeams.length];
            const { colorBase, colorLight } = game.pickTeamColor(teamId);
            const air = game.rollBaselineInitialAir(i);
            game.createSoftBall(cx, cy, seedRadius, colorBase, colorLight);
            const ball = game.balls[game.balls.length - 1];
            ball.air = air;
            game.applyBallAirVisual(ball);
            const visualR = seedRadius * game.currentInflateScale(ball);
            game.reshapeBallToCircle(ball, visualR);
            game.localRelaxBall(ball, 10);
            game.syncBallRestState(ball);
            game.schedulePopIfEmpty(ball);
            ball.labelLastCeil = game.displayAirForLabel(ball);
            game.onBalloonSpawn(ball, i, level);
        }

        game.refreshBallCentroids();
        game.updateBallCount();
    }

}
