import * as Config from '../config.js';
import { isClownBall } from '../items/clownBalloon.js';
import { isRainbowBall } from '../items/rainbowBalloon.js';

/** InputController */
export class InputController {
    constructor(game) {
        this.game = game;
    }

    screenToLogical(clientX, clientY) {
        const game = this.game;
            const rect = game.dom.canvas.getBoundingClientRect();
            return {
                x: (clientX - rect.left) * (Config.width / rect.width),
                y: (clientY - rect.top) * (Config.height / rect.height)
            };
    }

    pickBalloonAt(x, y) {
        const game = this.game;
            if (game.isInPumpZone(y)) return null;
            for (let i = game.balls.length - 1; i >= 0; i--) {
                const pts = game.balls[i].particles;
                if (game.pointInPolygon(x, y, pts)) return game.balls[i];
                const c = game.polygonCentroid(pts);
                const dist = Math.hypot(x - c.x, y - c.y);
                if (dist < game.balls[i].radius * 1.05) return game.balls[i];
            }
            return null;
    }

    startDrag(clientX, clientY) {
        const game = this.game;
            if (game.appScreen !== 'game') return;
            if (game.itemRevealActive || game.itemRevealAnchorHold) return;
            if (game.isGameplayFrozen?.()) return;
            game.sfx.resume();
            const pos = game.screenToLogical(clientX, clientY);
            game.mouse.x = pos.x;
            game.mouse.y = pos.y;
            game.pointerDownPos.x = pos.x;
            game.pointerDownPos.y = pos.y;
            game.pointerDown = true;
            game.dragNode = null;
            game.pendingDragParticle = null;

            if (game.gameOutcome === 'transition') return;

            if (game.gameOutcome === 'won' || game.gameOutcome === 'lost') {
                if (game.gameOutcome === 'won' && game.hitSettlementButton(game.settlementButtons.next, game.mouse.x, game.mouse.y)) {
                    game.advanceAfterWin();
                    return;
                }
                if (game.hitSettlementButton(game.settlementButtons.restart, game.mouse.x, game.mouse.y)) {
                    if (game.currentLevelSpec?.testLab && game.lastTestLabParams) {
                        game.loadTestLabLevel(game.lastTestLabParams);
                    } else {
                        game.scheduleLoadLevel(game.levelIndex);
                    }
                    return;
                }
                return;
            }

            if (game.isInPumpZone(game.mouse.y)) {
                const pumpIdx = game.pickPumpAt(game.mouse.x, game.mouse.y);
                if (pumpIdx >= 0) game.selectedPumpIndex = pumpIdx;
                return;
            }

            const hitBall = game.pickBalloonAt(game.mouse.x, game.mouse.y);
            if (hitBall) {
                if (isRainbowBall(hitBall)) {
                    game.sfx.playDenied();
                    return;
                }
                if (isClownBall(hitBall)) {
                    let minDist = 42;
                    for (const p of hitBall.particles) {
                        const dist = Math.hypot(p.x - game.mouse.x, p.y - game.mouse.y);
                        if (dist < minDist) {
                            minDist = dist;
                            game.pendingDragParticle = p;
                        }
                    }
                    return;
                }
                const idx = game.selectPumpForBall(hitBall);
                if (idx >= 0 && game.pumpFuelRemaining[idx] > 0) {
                    game.beginPlayerDartAction();
                    game.activeInflateBall = hitBall;
                } else {
                    game.sfx.playDenied();
                }
                return;
            }
            game.activeInflateBall = null;

            let minDist = 42;
            for (const p of game.particles) {
                const dist = Math.hypot(p.x - game.mouse.x, p.y - game.mouse.y);
                if (dist < minDist) {
                    minDist = dist;
                    game.pendingDragParticle = p;
                }
            }
    }

    moveDrag(clientX, clientY) {
        const game = this.game;
            const pos = game.screenToLogical(clientX, clientY);
            game.mouse.x = pos.x;
            game.mouse.y = pos.y;

            if (!game.pointerDown || game.activeInflateBall || game.dragNode || !game.pendingDragParticle) return;
            const moved = Math.hypot(game.mouse.x - game.pointerDownPos.x, game.mouse.y - game.pointerDownPos.y);
            if (moved >= Config.DRAG_MOVE_THRESHOLD) {
                game.dragNode = game.pendingDragParticle;
                game.pendingDragParticle = null;
            }
    }

    endDrag() {
        const game = this.game;
            game.dragNode = null;
            game.pendingDragParticle = null;
            game.activeInflateBall = null;
            game.pointerDown = false;
    }

    hitSettlementButton(btn, x, y) {
        const game = this.game;
            if (!btn) return false;
            return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
    }

    polygonCentroid(poly) {
        const game = this.game;
            let cx = 0;
            let cy = 0;
            for (let i = 0; i < poly.length; i++) {
                cx += poly[i].x;
                cy += poly[i].y;
            }
            return { x: cx / poly.length, y: cy / poly.length };
    }

    pointInPolygon(px, py, poly) {
        const game = this.game;
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i].x, yi = poly[i].y;
                const xj = poly[j].x, yj = poly[j].y;
                const intersects = ((yi > py) !== (yj > py)) &&
                    (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-8) + xi);
                if (intersects) inside = !inside;
            }
            return inside;
    }

}
