import * as Config from '../config.js';
import { isClownBall } from '../items/clownBalloon.js';
import { isRainbowBall } from '../items/rainbowBalloon.js';

const JOKER_ASSETS = ['joker.png', 'joker2.png'];
/** 低于此 alpha 的像素视为全透明，避免缩放后出现方形描边 */
const JOKER_ALPHA_CUT = 14;

/** Renderer */
export class Renderer {
    constructor(game) {
        this.game = game;
        this.jokerFaceImages = JOKER_ASSETS.map((file) => {
            const img = new Image();
            img.decoding = 'async';
            img.addEventListener('load', () => this._bakeJokerCanvas(img), { once: true });
            img.src = new URL(`../../assets/${file}`, import.meta.url).href;
            if (img.complete && img.naturalWidth) this._bakeJokerCanvas(img);
            return img;
        });

        this.luckIconImage = new Image();
        this.luckIconImage.decoding = 'async';
        this.luckIconImage.addEventListener('load', () => this._bakeJokerCanvas(this.luckIconImage), { once: true });
        this.luckIconImage.src = new URL('../../assets/luck.png', import.meta.url).href;
        if (this.luckIconImage.complete && this.luckIconImage.naturalWidth) {
            this._bakeJokerCanvas(this.luckIconImage);
        }
    }

    _bakeJokerCanvas(img) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;
        const bake = document.createElement('canvas');
        bake.width = w;
        bake.height = h;
        const bctx = bake.getContext('2d', { willReadFrequently: true });
        bctx.drawImage(img, 0, 0);
        const data = bctx.getImageData(0, 0, w, h);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] <= JOKER_ALPHA_CUT) {
                px[i] = 0;
                px[i + 1] = 0;
                px[i + 2] = 0;
                px[i + 3] = 0;
            }
        }
        bctx.putImageData(data, 0, 0);
        img.jokerCanvas = bake;
    }

    _jokerDrawable(img) {
        return img?.jokerCanvas || img;
    }

    _jokerReady(img) {
        if (!img) return false;
        if (img.jokerCanvas) return true;
        return img.complete && img.naturalWidth > 0;
    }

    /** @returns {HTMLImageElement | null} */
    pickJokerImage(opts = {}) {
        const imgs = this.jokerFaceImages.filter((im) => this._jokerReady(im));
        if (!imgs.length) return null;
        const flash = opts.flashAlternate === true;
        if (!flash || imgs.length === 1) return imgs[0];
        const flashHz = opts.flashHz ?? 2;
        const frame = Math.floor(this.game.simTime * flashHz) % imgs.length;
        return imgs[frame];
    }

    drawJokerIconAt(cx, cy, ballRadius, opts = {}) {
        const ctx = this.game.dom.ctx;
        const img = this.pickJokerImage(opts);
        if (!img) return null;

        const source = this._jokerDrawable(img);
        const sw = source.width || source.naturalWidth;
        const sh = source.height || source.naturalHeight;
        const burn = opts.burn ?? 0;
        const purpleGlow = opts.purpleGlow ?? 0;
        const targetH = ballRadius * 1.664;
        const scale = targetH / sh;
        const iw = sw * scale;
        const ih = sh * scale;
        const x = cx - iw * 0.5;
        const y = cy - ih * 0.5;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const needsFx = purpleGlow > 0 || burn > 0.02;
        if (!needsFx) {
            ctx.drawImage(source, 0, 0, sw, sh, x, y, iw, ih);
        } else {
            const pulse = 0.55 + 0.45 * Math.sin(this.game.simTime * 8);
            const layer = document.createElement('canvas');
            layer.width = Math.max(1, Math.ceil(iw));
            layer.height = Math.max(1, Math.ceil(ih));
            const lctx = layer.getContext('2d');
            lctx.drawImage(source, 0, 0, sw, sh, 0, 0, layer.width, layer.height);
            if (purpleGlow > 0) {
                lctx.globalCompositeOperation = 'source-atop';
                lctx.fillStyle = `rgba(168, 85, 247, ${(0.12 + 0.38 * purpleGlow) * pulse})`;
                lctx.fillRect(0, 0, layer.width, layer.height);
            }
            if (burn > 0.02) {
                lctx.globalCompositeOperation = 'source-atop';
                const g = lctx.createLinearGradient(0, 0, layer.width, layer.height);
                g.addColorStop(0, `rgba(255, 160, 60, ${burn * 0.45})`);
                g.addColorStop(0.45, `rgba(70, 32, 20, ${burn * 0.82})`);
                g.addColorStop(1, `rgba(8, 6, 6, ${burn * 0.95})`);
                lctx.fillStyle = g;
                lctx.fillRect(0, 0, layer.width, layer.height);
            }
            ctx.drawImage(layer, x, y);
        }

        ctx.restore();
        return { x, y, w: iw, h: ih };
    }

    drawClownEmojiAt(cx, cy, ballRadius) {
        const ctx = this.game.dom.ctx;
        const fontSize = Math.max(20, ballRadius * 1.28);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillText('🤡', cx, cy);
        ctx.restore();
    }

    drawClownFace(ball, cx, cy) {
        this.drawClownEmojiAt(cx, cy, ball.radius);
    }

    drawEmbeddedItemIcon(ball, cx, cy) {
        const embedded = ball.embeddedItem;
        if (!embedded?.itemId) return;
        const icon = embedded.def?.icon;
        if (icon === '🤡') {
            this.drawClownEmojiAt(cx, cy, ball.radius * 0.72);
        }
    }

    _parseHexRgb(hex) {
        const s = hex.replace('#', '');
        return [
            parseInt(s.slice(0, 2), 16),
            parseInt(s.slice(2, 4), 16),
            parseInt(s.slice(4, 6), 16),
        ];
    }

    _lerpHexColor(a, b, t) {
        const c0 = this._parseHexRgb(a);
        const c1 = this._parseHexRgb(b);
        const mix = (i) => Math.round(c0[i] + (c1[i] - c0[i]) * t);
        return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
    }

    /** @param {string[]} spectrum 首尾同色 */
    _sampleRainbowSpectrum(spectrum, t) {
        let u = t % 1;
        if (u < 0) u += 1;
        const seg = spectrum.length - 1;
        const f = u * seg;
        const i = Math.min(Math.floor(f), seg - 1);
        return this._lerpHexColor(spectrum[i], spectrum[i + 1], f - i);
    }

    /**
     * 按正面半球经纬采样：色带沿球面弯曲，缓慢环向平移（非直线条纹）
     */
    _paintSphericalRainbowOverlay(ctx, ball, cx, cy, r, simTime) {
        const spectrum = ['#ff5c5c', '#ffb347', '#ffe066', '#69db7c', '#4dabf7', '#9775fa', '#ff5c5c'];
        const bandRepeats = 0.58;
        const phase = (simTime * 0.2 + (ball.rainbowHueOffset ?? 0) * 0.002) % 1;

        const pad = Math.ceil(r * 1.28);
        const w = pad * 2;
        const h = pad * 2;
        const layer = document.createElement('canvas');
        layer.width = w;
        layer.height = h;
        const lctx = layer.getContext('2d');
        const img = lctx.createImageData(w, h);
        const data = img.data;
        const ox = cx - pad;
        const oy = cy - pad;
        const invR = 1 / Math.max(r, 1);

        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const dx = (ox + px - cx) * invR;
                const dy = (oy + py - cy) * invR;
                const d2 = dx * dx + dy * dy;
                if (d2 > 1.02) continue;
                const dz = Math.sqrt(Math.max(0, 1 - d2));
                const lon = Math.atan2(dx, dz);
                let u = ((lon / (Math.PI * 2) + 0.5) * bandRepeats + phase) % 1;
                if (u < 0) u += 1;
                const rgb = this._sampleRainbowSpectrum(spectrum, u);
                const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb);
                if (!m) continue;
                const idx = (py * w + px) * 4;
                data[idx] = Number(m[1]);
                data[idx + 1] = Number(m[2]);
                data[idx + 2] = Number(m[3]);
                data[idx + 3] = 255;
            }
        }
        lctx.putImageData(img, 0, 0);
        ctx.drawImage(layer, ox, oy);
    }

    /** 灰白底 + 70% 透明球面环向彩虹（路径需已 closePath） */
    drawRainbowBalloonFill(ctx, ball, cx, cy) {
        const game = this.game;
        const r = ball.radius;

        const base = ctx.createRadialGradient(
            cx - r * 0.32, cy - r * 0.32, r * 0.08,
            cx, cy, r * 1.08,
        );
        base.addColorStop(0, '#f8f8fb');
        base.addColorStop(0.55, '#e8e9ef');
        base.addColorStop(1, '#c9cad4');
        ctx.fillStyle = base;
        ctx.fill();

        ctx.save();
        ctx.clip();

        ctx.globalAlpha = 0.7;
        this._paintSphericalRainbowOverlay(ctx, ball, cx, cy, r, game.simTime);
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(
            cx - r * 0.38, cy - r * 0.38,
            r * 0.22, r * 0.13, -Math.PI / 4, 0, Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
    }

    /** 彩虹气球中央 luck.png 幸运草图标 */
    drawRainbowLuckyClover(ball, cx, cy) {
        const ctx = this.game.dom.ctx;
        const img = this.luckIconImage;
        if (!img?.complete || !img.naturalWidth) return;

        const source = this._jokerDrawable(img);
        const sw = source.width || source.naturalWidth;
        const sh = source.height || source.naturalHeight;
        const targetH = ball.radius * 0.92;
        const scale = targetH / sh;
        const iw = sw * scale;
        const ih = sh * scale;
        const x = cx - iw * 0.5;
        const y = cy - ih * 0.5 - ball.radius * 0.02;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, sw, sh, x, y, iw, ih);
        ctx.restore();
    }

    drawClownPopCinematic() {
        const game = this.game;
        const cine = game.clownCinematic;
        if (!cine || cine.phase !== 'play') return;

        const ctx = game.dom.ctx;
        const snap = cine.snapshot;
        const { cx, cy, radius, colorBase, colorLight } = snap;
        const t = Math.min(1, cine.elapsed / cine.duration);

        ctx.save();
        const darkA = Math.min(0.88, 0.42 + t * 0.46);
        ctx.fillStyle = `rgba(5, 4, 12, ${darkA})`;
        ctx.fillRect(0, 0, Config.width, Config.height);

        const grad = ctx.createRadialGradient(
            cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
            cx, cy, radius * 1.1
        );
        grad.addColorStop(0, colorLight);
        grad.addColorStop(1, colorBase);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.06, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 85, 247, 0.35)`;
        ctx.lineWidth = 3;
        ctx.stroke();

        game.drawClownEmojiAt(cx, cy, radius);
        ctx.restore();
    }

    drawBallAirLabel(ball, cx, cy) {
        const game = this.game;
            const ctx = game.dom.ctx;
            game.ensureBallLabelState(ball);
            const displayAir = game.displayAirForLabel(ball);
            const airLabel = String(displayAir);
            const redBlend = game.displayAirLabelRedBlend(ball);
            const atBurst = ball.imminentPopDelay != null;
            let fontSize = Math.max(15, Math.min(34, ball.radius * 0.52));
            const burstPulse = atBurst ? 1 + 0.14 * Math.sin(game.simTime * 38) : 1;
            const scale = ball.labelScale * (1 + ball.labelPulse * 0.12) * burstPulse;
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
            const fillR = 255;
            const fillG = Math.round(255 * (1 - redBlend) + 48 * redBlend);
            const fillB = Math.round(255 * (1 - redBlend) + 52 * redBlend);
            const strokeA = 0.35 + redBlend * 0.35;
            ctx.strokeStyle = `rgba(${Math.round(40 + 120 * redBlend)}, 0, 0, ${strokeA})`;
            ctx.fillStyle = `rgba(${fillR}, ${fillG}, ${fillB}, ${atBurst ? 1 : 0.96})`;
            if (redBlend > 0.02) {
                ctx.shadowColor = `rgba(255, 60, 40, ${0.25 + redBlend * 0.55})`;
                ctx.shadowBlur = 4 + redBlend * 14;
            }
            ctx.strokeText(airLabel, cx, labelY);
            ctx.fillText(airLabel, cx, labelY);
            ctx.shadowBlur = 0;
    }

    drawImminentPopBallFx(ball, cx, cy) {
        if (ball.imminentPopDelay == null) return;
        const game = this.game;
        const ctx = game.dom.ctx;
        const total = Config.FULL_POP_DELAY;
        const progress = 1 - Math.max(0, ball.imminentPopDelay) / total;
        const baseR = ball.radius;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const glowR = baseR * (1.05 + progress * 0.75);
        const glow = ctx.createRadialGradient(cx, cy, baseR * 0.15, cx, cy, glowR);
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.22 + progress * 0.28})`);
        glow.addColorStop(0.35, `rgba(255, 255, 255, ${0.1 + progress * 0.14})`);
        glow.addColorStop(0.7, `rgba(255, 255, 255, ${0.04 + progress * 0.05})`);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();

        const waveCount = 3;
        const maxSpread = 2.65;
        for (let i = 0; i < waveCount; i++) {
            const lag = i * 0.18;
            const t = Math.min(1, Math.max(0, progress * 1.15 - lag));
            if (t <= 0.02) continue;
            const ease = 1 - Math.pow(1 - t, 2.4);
            const radius = baseR * (1.02 + ease * maxSpread);
            const fade = Math.pow(1 - t, 1.85);
            const alpha = fade * (0.38 - i * 0.08);
            const width = (2.8 - ease * 1.6) * (1 - i * 0.15);

            ctx.lineWidth = Math.max(0.8, width);
            ctx.strokeStyle = `rgba(255, 252, 245, ${alpha})`;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.lineWidth = Math.max(0.5, width * 0.55);
            ctx.strokeStyle = `rgba(255, 140, 90, ${alpha * 0.45})`;
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
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

                if (isRainbowBall(ball)) {
                    game.drawRainbowBalloonFill(ctx, ball, cx, cy);
                } else {
                    const grad = ctx.createRadialGradient(
                        cx - ball.radius * 0.3, cy - ball.radius * 0.3, ball.radius * 0.1,
                        cx, cy, ball.radius * 1.1
                    );
                    grad.addColorStop(0, ball.colorLight);
                    grad.addColorStop(1, ball.colorBase);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }

                if (!isClownBall(ball) && !isRainbowBall(ball)) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
                    ctx.beginPath();
                    ctx.ellipse(
                        cx - ball.radius * 0.4, cy - ball.radius * 0.4,
                        ball.radius * 0.22, ball.radius * 0.13, -Math.PI / 4, 0, Math.PI * 2
                    );
                    ctx.fill();
                    game.drawImminentPopBallFx(ball, cx, cy);
                    game.drawBallAirLabel(ball, cx, cy);
                    game.drawEmbeddedItemIcon?.(ball, cx, cy);
                } else if (isClownBall(ball)) {
                    game.drawClownFace(ball, cx, cy);
                } else if (isRainbowBall(ball)) {
                    game.drawRainbowLuckyClover(ball, cx, cy);
                }
            }

            game.drawTetrisWalls(ctx);

            for (const fx of game.popEffects) {
                const alpha = Math.max(0, fx.life / fx.maxLife);
                const r = parseInt(fx.color.slice(1, 3), 16);
                const g = parseInt(fx.color.slice(3, 5), 16);
                const b = parseInt(fx.color.slice(5, 7), 16);
                if (fx.kind === 'streak') {
                    const spd = Math.hypot(fx.vx, fx.vy) || 1;
                    const ux = fx.vx / spd;
                    const uy = fx.vy / spd;
                    const len = (fx.streakLen ?? 14) * (0.35 + alpha);
                    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
                    ctx.lineWidth = Math.max(1, fx.size * 0.55);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(fx.x - ux * len * 0.35, fx.y - uy * len * 0.35);
                    ctx.lineTo(fx.x + ux * len, fx.y + uy * len);
                    ctx.stroke();
                    continue;
                }
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
            game.drawClownPopCinematic();
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
