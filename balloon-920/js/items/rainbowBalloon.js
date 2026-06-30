import * as Config from '../config.js';
import { clownChainColorKey } from './clownPopCinematic.js';

/** 彩虹球固定剩余气量（不可打气，仅用于体积，不显示数字） */
export const RAINBOW_BALLOON_REMAINING_AIR = 42;

/** @param {object} ball */
export function isRainbowBall(ball) {
    return ball?.role === 'rainbow';
}

/**
 * 是否构成同色连锁。彩虹球不视为万能色：仅在与 chainColor 一致时与彩虹配对，
 * 或由 getTouchingSameColorNeighbors 对非彩虹球排除彩虹邻居。
 * @param {object} a
 * @param {object} b
 * @param {string|null} [chainColor] 彩虹连爆时继承的色键（clownChainColorKey）
 */
export function ballsChainTogether(a, b, chainColor = null) {
    if (!a || !b || a === b) return false;
    if (isRainbowBall(a) && isRainbowBall(b)) return false;
    if (isRainbowBall(a)) {
        return chainColor != null && clownChainColorKey(b) === chainColor;
    }
    if (isRainbowBall(b)) {
        return chainColor != null && clownChainColorKey(a) === chainColor;
    }
    return clownChainColorKey(a) === clownChainColorKey(b);
}

/** @param {object} ball */
export function chainColorKeyForPop(ball) {
    return clownChainColorKey(ball);
}

/**
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function findRainbowsTouching(game, sourceBall) {
    const list = [];
    for (let i = 0; i < game.balls.length; i++) {
        const other = game.balls[i];
        if (!isRainbowBall(other) || other === sourceBall) continue;
        if (!game.ballsPhysicallyTouch(sourceBall, other)) continue;
        list.push(other);
    }
    return list;
}

/** @param {import('../BalloonGameApp.js').BalloonGameApp} game */
export function enqueueRainbowsNearPop(game, sourceBall) {
    const rainbows = findRainbowsTouching(game, sourceBall);
    if (!rainbows.length) return;
    game.ensureChainVisited();
    const chainColor = chainColorKeyForPop(sourceBall);
    for (let i = 0; i < rainbows.length; i++) {
        const r = rainbows[i];
        if (!game.balls.includes(r) || game.chainPopVisited.has(r)) continue;
        r.chainPopColor = chainColor;
        game.chainPopVisited.add(r);
        game.chainPopQueue.push(r);
    }
}

/**
 * @param {import('../BalloonGameApp.js').BalloonGameApp} game
 */
export function spawnRainbowBalloon(game, cx, cy, radius) {
    const r = radius ?? Config.MIN_BALLOON_RADIUS;
    game.createSoftBall(cx, cy, r, '#d0d1d9', '#f6f6f9');
    const ball = game.balls[game.balls.length - 1];
    ball.role = 'rainbow';
    ball.rainbowHueOffset = Math.random() * 360;
    ball.air = RAINBOW_BALLOON_REMAINING_AIR;
    game.applyBallAirVisual(ball);
    const visualR = r * game.currentInflateScale(ball);
    game.reshapeBallToCircle(ball, visualR);
    game.localRelaxBall(ball, 10);
    game.syncBallRestState(ball);
    return ball;
}