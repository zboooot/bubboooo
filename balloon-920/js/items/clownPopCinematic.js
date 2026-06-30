import * as Config from '../config.js';
import { isClownBall, enqueueClownsNearPop } from './clownShared.js';
import { enqueueRainbowsNearPop } from './rainbowBalloon.js';

const BURST_SPAWN_INTERVAL_SEC = 0.36;

/** 小丑按白色球计入同色连锁（仅颜色键，仍不可打气） */
export function clownChainColorKey(ball) {
    if (isClownBall(ball)) return '__clown_white__';
    return ball.colorBase;
}

/** @param {import('../BalloonGameApp.js').BalloonGameApp} game */
export function isClownCinematicShowing(_game) {
    return false;
}

export function isGameplayFrozen(_game) {
    return false;
}

function isClownActivationBusy(game) {
    return !!game.itemReveal || (game.clownBurstSpawn?.remaining ?? 0) > 0;
}

/** 揭晓结束后直接复制气球（不再播暗屏演出） */
export function resumeClownCinematicAfterReveal(game, snapshot) {
    if (!snapshot) return;
    if (isClownActivationBusy(game)) {
        if (!game.pendingClownBurstSnapshots) game.pendingClownBurstSnapshots = [];
        game.pendingClownBurstSnapshots.push(snapshot);
        return;
    }
    spawnClownBurstFromSnapshot(game, snapshot);
}

function spawnClownBurstFromSnapshot(game, snapshot) {
    try {
        startClownBurstSpawn(game, snapshot);
    } catch (err) {
        console.error('[clown] spawn failed', err);
    }
    game.checkLevelWin();
    game.checkLevelLose();
    game.tryDrainPendingClownItemReveals?.();
}

function drainPendingClownBurstSnapshots(game) {
    const queue = game.pendingClownBurstSnapshots;
    if (!queue?.length || isClownActivationBusy(game)) return;
    const snapshot = queue.shift();
    spawnClownBurstFromSnapshot(game, snapshot);
}

function drainPendingClownActivations(game) {
    const queue = game.pendingClownActivations;
    if (!queue?.length || isClownActivationBusy(game)) return;
    const next = queue.shift();
    if (!next?.ball || !game.balls.includes(next.ball)) {
        drainPendingClownActivations(game);
        return;
    }
    beginClownPopCinematic(game, next.ball, next.fromChain);
}

/**
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function beginClownPopCinematic(game, ball, fromChain = false) {
    if (!game.balls.includes(ball) || !isClownBall(ball)) return;

    if (isClownActivationBusy(game)) {
        if (!game.pendingClownActivations) game.pendingClownActivations = [];
        game.pendingClownActivations.push({ ball, fromChain });
        return;
    }

    if (!fromChain) {
        game.resetChainPopState();
        game.chainComboCount = 1;
    } else {
        game.chainComboCount++;
    }
    game.ensureChainVisited();
    game.chainPopVisited.add(ball);

    game.sfx.playPop(game.chainComboCount);
    game.bumpComboHud(game.chainComboCount);

    game.spawnPopEffect(ball);
    game.onBalloonPop(ball, {
        fromChain,
        comboCount: game.chainComboCount,
        isClown: true,
    });

    enqueueClownsNearPop(game, ball);
    enqueueRainbowsNearPop(game, ball);

    const snapshot = {
        cx: ball.cx,
        cy: ball.cy,
        radius: ball.radius,
        colorBase: ball.colorBase,
        colorLight: ball.colorLight,
        copyMin: ball.clownCopyMin ?? 5,
        copyMax: ball.clownCopyMax ?? 10,
    };

    const idx = game.balls.indexOf(ball);
    if (idx >= 0) game.destroyBall(idx);
    game.updateBallCount();

    game.activeInflateBall = null;
    game.dragNode = null;
    game.pendingDragParticle = null;
    game.pointerDown = false;

    const started = game.showClownActivationReveal?.(snapshot);
    if (!started) {
        if (!game.pendingClownItemReveals) game.pendingClownItemReveals = [];
        game.pendingClownItemReveals.push(snapshot);
    }
}

/** 保留挂载点；暗屏演出已移除 */
export function updateClownPopCinematic(_game, _dt) {}

function applyBalloonDropFromTopVelocity(ball, rng = Math.random) {
    const dropVy = 95 + rng() * 75;
    const driftVx = (rng() - 0.5) * 18;
    for (const p of ball.particles) {
        p.vy = dropVy;
        p.vx = driftVx;
        p.px = p.x;
        p.py = p.y;
    }
}

/**
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function updateClownBurstSpawn(game, dt) {
    const burst = game.clownBurstSpawn;
    if (!burst || burst.remaining <= 0) {
        if (burst) game.clownBurstSpawn = null;
        drainPendingClownBurstSnapshots(game);
        drainPendingClownActivations(game);
        return;
    }

    burst.accum += dt;
    while (burst.remaining > 0 && burst.accum >= burst.interval) {
        burst.accum -= burst.interval;
        spawnOneDuplicateDropFromTop(game, burst);
        burst.remaining--;
        burst.spawnIndex++;
        game.updateBallCount();
    }

    if (burst.remaining <= 0) {
        game.clownBurstSpawn = null;
        drainPendingClownBurstSnapshots(game);
        drainPendingClownActivations(game);
    }
}

/** 保留接口，当前复制球不再使用原地挤出生长 */
export function updateBalloonSpawnGrows(_game, _dt) {}

function startClownBurstSpawn(game, snap) {
    const minN = snap.copyMin ?? 5;
    const maxN = snap.copyMax ?? 10;
    const n = minN + Math.floor(Math.random() * (maxN - minN + 1));
    game.clownBurstSpawn = {
        teams: game.activeTeams?.length ? game.activeTeams.slice() : [0],
        remaining: n,
        interval: BURST_SPAWN_INTERVAL_SEC,
        accum: BURST_SPAWN_INTERVAL_SEC * 0.35,
        spawnIndex: 0,
    };
}

function spawnOneDuplicateDropFromTop(game, burst) {
    const rng = Math.random;
    const teamId = burst.teams[Math.floor(rng() * burst.teams.length)];
    const { colorBase, colorLight } = game.pickTeamColor(teamId);
    const seedRadius = Config.MIN_BALLOON_RADIUS * (0.85 + rng() * 0.35);
    const air = game.randomInitialAir(Math.floor(rng() * 24));
    const visualR = seedRadius * game.visualScaleFromAir(air);
    const playW = Config.width - Config.BALLOON_FIELD_PAD_X * 2;
    const cx = Config.BALLOON_FIELD_PAD_X + visualR + rng() * Math.max(0, playW - 2 * visualR);
    const cy = -visualR * (1.15 + rng() * 0.65);

    game.createSoftBall(cx, cy, seedRadius, colorBase, colorLight);
    const ball = game.balls[game.balls.length - 1];
    ball.air = air;
    ball.labelLastCeil = game.displayAirForLabel(ball);
    game.applyBallAirVisual(ball);
    game.reshapeBallToCircle(ball, visualR);
    game.localRelaxBall(ball, 6);
    game.syncBallRestState(ball);
    applyBalloonDropFromTopVelocity(ball, rng);
    game.schedulePopIfEmpty(ball);
    game.onBalloonSpawn(ball, burst.spawnIndex, game.currentLevelSpec);
    game.refreshBallCentroids();
}