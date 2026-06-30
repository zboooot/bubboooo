import * as Config from '../config.js';
import { clownChainColorKey } from './clownPopCinematic.js';

/** 彩虹球固定剩余气量（不可打气，仅用于体积，不显示数字） */
export const RAINBOW_BALLOON_REMAINING_AIR = 42;

/** @param {object} ball */
export function isRainbowBall(ball) {
    return ball?.role === 'rainbow';
}

/**
 * 是否与 source 构成连锁（彩虹与任意色相连）
 * @param {object} a
 * @param {object} b
 */
export function ballsChainTogether(a, b) {
    if (!a || !b || a === b) return false;
    if (isRainbowBall(a) || isRainbowBall(b)) return true;
    return clownChainColorKey(a) === clownChainColorKey(b);
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
    for (let i = 0; i < rainbows.length; i++) {
        const r = rainbows[i];
        if (!game.balls.includes(r) || game.chainPopVisited.has(r)) continue;
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