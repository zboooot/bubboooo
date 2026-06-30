/** 小丑气球共享逻辑（避免 clownBalloon ↔ clownPopCinematic 循环引用） */

/** @param {object} ball */
export function isClownBall(ball) {
    return ball?.role === 'clown';
}

/** @param {import('../BalloonGameApp.js').BalloonGameApp} game */
export function findClownsTouching(game, sourceBall) {
    const list = [];
    for (let i = 0; i < game.balls.length; i++) {
        const other = game.balls[i];
        if (!isClownBall(other) || other === sourceBall) continue;
        if (!game.ballsPhysicallyTouch(sourceBall, other)) continue;
        list.push(other);
    }
    return list;
}

/** @param {import('../BalloonGameApp.js').BalloonGameApp} game */
export function enqueueClownsNearPop(game, sourceBall) {
    const clowns = findClownsTouching(game, sourceBall);
    if (!clowns.length) return;
    game.ensureChainVisited();
    for (let i = 0; i < clowns.length; i++) {
        const c = clowns[i];
        if (!game.balls.includes(c) || game.chainPopVisited.has(c)) continue;
        game.chainPopVisited.add(c);
        game.chainPopQueue.push(c);
    }
}