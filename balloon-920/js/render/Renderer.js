import * as Config from '../config.js';

/** Renderer */
export class Renderer {
    constructor(game) {
        this.game = game;
    }

    drawBallAirLabel(ball, cx, cy) {
        const game = this.game;
            const ctx = game.dom.ctx;
            game.ensureBallLabelState(ball);
            const airLabel = ball.air > 0 ? String(Math.ceil(ball.air)) : '0';
            let fontSize = Math.max(15, Math.min(34, ball.radius * 0.52));
            const scale = ball.labelScale * (1 + ball.labelPulse * 0.12);
            fontSize *= scale;
            fontSize = Math.min(fontSize, ball.radius * 0.8);

            ctx.font = `bold ${fontSize}px "ZCOOL KuaiLe", system-ui, sans-serif`;
            let textW = ctx.measureText(airLabel).width;
            const maxW = ball.radius * 1.55;
            if (textW > maxW) {
                fontSize *= maxW / textW;
                ctx.font = `bold ${fontSize}px "ZCOOL KuaiLe", system-ui, sans-serif`;
                textW = ctx.measureText(airLabel).width;
            }

            const textH = fontSize;
            let lift = ball.labelLift;
            const maxLift = Math.max(0, ball.radius - textH * 0.52 - 3);
            lift = Math.min(lift, maxLift);
            const labelY = cy - lift;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(2, fontSize * 0.14);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.strokeText(airLabel, cx, labelY);
            ctx.fillText(airLabel, cx, labelY);
    }

    drawBackground() {
        const game = this.game;
            const ctx = game.dom.ctx;
            ctx.drawImage(game.bgCanvas, 0, 0);
    }

    drawTransitionFade() {
        const game = this.game;
            const ctx = game.dom.ctx;
            if (game.gameOutcome !== 'transition' && game.transitionFade <= 0) return;
            const a = Math.min(1, Math.max(0, game.transitionFade)) * 0.92;
            if (a <= 0.001) return;
            ctx.fillStyle = `rgba(8, 8, 18, ${a})`;
            ctx.fillRect(0, 0, Config.width, Config.height);
    }

    draw() {
        const game = this.game;
            const ctx = game.dom.ctx;
            game.drawBackground();

            for (const ball of game.balls) {
                const pts = ball.particles;
                if (!pts.length) continue;

                const cx = ball.cx;
                const cy = ball.cy;

                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.closePath();

                const grad = ctx.createRadialGradient(
                    cx - ball.radius * 0.3, cy - ball.radius * 0.3, ball.radius * 0.1,
                    cx, cy, ball.radius * 1.1
                );
                grad.addColorStop(0, ball.colorLight);
                grad.addColorStop(1, ball.colorBase);

                ctx.fillStyle = grad;
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
                ctx.beginPath();
                ctx.ellipse(
                    cx - ball.radius * 0.4, cy - ball.radius * 0.4,
                    ball.radius * 0.22, ball.radius * 0.13, -Math.PI / 4, 0, Math.PI * 2
                );
                ctx.fill();

                game.drawBallAirLabel(ball, cx, cy);
            }

            if (!game.itemRevealActive) for (const fx of game.popEffects) {
                const alpha = Math.max(0, fx.life / fx.maxLife);
                const r = parseInt(fx.color.slice(1, 3), 16);
                const g = parseInt(fx.color.slice(3, 5), 16);
                const b = parseInt(fx.color.slice(5, 7), 16);
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.size * alpha, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
                ctx.fill();
            }

            if (game.activeInflateBall && game.balls.includes(game.activeInflateBall)) {
                const pts = game.activeInflateBall.particles;
                const c = game.polygonCentroid(pts);
                ctx.beginPath();
                ctx.arc(c.x, c.y, game.activeInflateBall.radius * 1.08, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + game.activeInflateBall.inflate * 0.5})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (game.dragNode) {
                ctx.beginPath();
                ctx.moveTo(game.dragNode.x, game.dragNode.y);
                ctx.lineTo(game.mouse.x, game.mouse.y);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(game.mouse.x, game.mouse.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fill();
            }

            game.drawItems(ctx);

            if (game.gameOutcome !== 'won' && game.gameOutcome !== 'lost') {
                game.drawPumpDock();
            }
            game.drawItemReveal(ctx);
            game.drawSettlementOverlay();
            game.drawCelebrateEffects();
            game.drawTransitionFade();
    }

    drawCelebrateEffects() {
        const game = this.game;
            const ctx = game.dom.ctx;
            if (game.gameOutcome !== 'won' || !game.celebrateEffects.length) return;
            for (const fx of game.celebrateEffects) {
                const t = Math.max(0, fx.life / fx.maxLife);
                const tw = 0.55 + 0.45 * Math.sin(fx.twinkle);
                const alpha = t * tw;
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.size * (0.6 + t * 0.5), 0, Math.PI * 2);
                ctx.fillStyle = fx.color;
                ctx.globalAlpha = alpha;
                ctx.fill();
                if (fx.size > 3) {
                    ctx.beginPath();
                    ctx.arc(fx.x, fx.y, fx.size * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = alpha * 0.85;
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
    }

    drawSettlementOverlay() {
        const game = this.game;
            const ctx = game.dom.ctx;
            if (game.gameOutcome !== 'won' && game.gameOutcome !== 'lost') {
                game.settlementButtons = { next: null, restart: null };
                return;
            }
            ctx.save();
            ctx.fillStyle = 'rgba(8, 8, 18, 0.58)';
            ctx.fillRect(0, 0, Config.width, Config.GROUND_Y);

            const level = game.currentLevelSpec || game.getLevelSpec(game.levelIndex);
            const isWin = game.gameOutcome === 'won';
            const hint = game.settlementHintForLevel(game.levelIndex, isWin);
            const hintBlock = isWin ? (hint ? 56 : 32) : 16;
            const panelW = Math.min(300, Config.width - 36);
            const panelH = isWin ? 198 + (hint ? 8 : 0) : 156;
            const px = (Config.width - panelW) * 0.5;
            const py = Config.GROUND_Y * 0.4 - panelH * 0.5;
            ctx.fillStyle = 'rgba(22, 24, 38, 0.96)';
            game.strokeRoundRect(px, py, panelW, panelH, 14);
            ctx.fill();
            ctx.strokeStyle = isWin ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 120, 120, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            if (isWin) {
                const titleGrad = ctx.createLinearGradient(Config.width * 0.5 - 90, py, Config.width * 0.5 + 90, py + 40);
                titleGrad.addColorStop(0, '#ffffff');
                titleGrad.addColorStop(0.45, '#fff7ed');
                titleGrad.addColorStop(1, '#fb923c');
                ctx.fillStyle = titleGrad;
                ctx.font = 'bold 22px "ZCOOL KuaiLe", system-ui, sans-serif';
                ctx.fillText('恭喜过关！', Config.width * 0.5, py + 40);
            } else {
                ctx.fillStyle = 'rgba(255, 180, 190, 0.98)';
                ctx.font = 'bold 22px "ZCOOL KuaiLe", system-ui, sans-serif';
                ctx.fillText('失败', Config.width * 0.5, py + 40);
            }
            ctx.font = '14px "ZCOOL KuaiLe", system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            const sub = isWin
                ? (level ? level.title : '')
                : '已无法过关（某色气筒用尽或无法再打爆任何气球）';
            ctx.fillText(sub, Config.width * 0.5, py + 66);

            const btnH = 38;
            const btnZoneTop = py + 82;
            const btnZoneBottom = py + panelH - hintBlock;
            const by = btnZoneTop + Math.max(0, (btnZoneBottom - btnZoneTop - btnH) * 0.5);

            function drawBtn(x, w, label, primary) {
                if (primary) {
                    const grad = ctx.createLinearGradient(x, by, x, by + btnH);
                    grad.addColorStop(0, isWin ? '#ff6b9d' : '#6b8cff');
                    grad.addColorStop(1, isWin ? '#d91e48' : '#3b5bdb');
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
                }
                game.strokeRoundRect(x, by, w, btnH, 10);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 15px "ZCOOL KuaiLe", system-ui, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, x + w * 0.5, by + btnH * 0.5);
                ctx.textBaseline = 'alphabetic';
                return { x, y: by, w, h: btnH };
            }

            game.settlementButtons.next = null;
            if (isWin) {
                const btnW = 118;
                const gap = 14;
                const totalBtnW = btnW * 2 + gap;
                const bx0 = (Config.width - totalBtnW) * 0.5;
                const nextLabel = game.testLevelId ? '再试一次' : '下一关';
                const restartLabel = game.testLevelId ? '重开本关' : '重新开始';
                game.settlementButtons.restart = drawBtn(bx0, btnW, restartLabel, false);
                game.settlementButtons.next = drawBtn(bx0 + btnW + gap, btnW, nextLabel, true);
            } else {
                const btnW = 168;
                const bx = (Config.width - btnW) * 0.5;
                game.settlementButtons.restart = drawBtn(bx, btnW, '重新开始', true);
            }

            if (hint) {
                ctx.font = '13px "ZCOOL KuaiLe", system-ui, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
                ctx.textBaseline = 'middle';
                const hintY = py + panelH - hintBlock * 0.5 + 4;
                ctx.fillText(hint, Config.width * 0.5, hintY);
                ctx.textBaseline = 'alphabetic';
            }
            ctx.restore();
    }

}
