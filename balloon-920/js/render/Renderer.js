import * as Config from '../config.js';
import { isClownBall } from '../items/clownBalloon.js';
import { isRainbowBall } from '../items/rainbowBalloon.js';

/** 小丑道具唯一贴图：镂空五官（透明底），叠在气球渐变色上 */
const CLOWN_ICON_FILE = 'clown.png';
/** 低于此 alpha 的像素视为全透明，避免缩放后出现方形描边 */
const ICON_ALPHA_CUT = 14;

/** 彩虹球面纹理相位量化（越小越省 CPU，环向滚动仍连续） */
const RAINBOW_OVERLAY_PHASE_BUCKETS = 8;
/** 烘焙像素相对逻辑尺寸的比例（绘制时放大，观感几乎不变） */
const RAINBOW_OVERLAY_PIXEL_SCALE = 0.45;
const RAINBOW_OVERLAY_POOL_MAX = 36;
const RAINBOW_SPECTRUM_RGB = [
    [255, 92, 92],
    [255, 179, 71],
    [255, 224, 102],
    [105, 219, 124],
    [77, 171, 247],
    [151, 117, 250],
    [255, 92, 92],
];
const RAINBOW_BAND_REPEATS = 0.58;

function sampleRainbowRgbAt(t) {
    let u = t % 1;
    if (u < 0) u += 1;
    const seg = RAINBOW_SPECTRUM_RGB.length - 1;
    const f = u * seg;
    const i = Math.min(Math.floor(f), seg - 1);
    const c0 = RAINBOW_SPECTRUM_RGB[i];
    const c1 = RAINBOW_SPECTRUM_RGB[i + 1];
    const a = f - i;
    return [
        (c0[0] + (c1[0] - c0[0]) * a + 0.5) | 0,
        (c0[1] + (c1[1] - c0[1]) * a + 0.5) | 0,
        (c0[2] + (c1[2] - c0[2]) * a + 0.5) | 0,
    ];
}

/** 直边闭合多边形（性能优先） */
function traceBalloonOutline(ctx, pts, originX = 0, originY = 0) {
    const n = pts.length;
    if (!n) return;
    ctx.moveTo(pts[0].x - originX, pts[0].y - originY);
    for (let i = 1; i < n; i++) {
        ctx.lineTo(pts[i].x - originX, pts[i].y - originY);
    }
    if (n > 2) ctx.closePath();
}

/** 边中点 + 顶点控制的闭合二次曲线；可选原点偏移（用于 translate 后本地填充） */
function traceSmoothBalloonOutline(ctx, pts, originX = 0, originY = 0) {
    const n = pts.length;
    if (n < 3) {
        if (!n) return;
        ctx.moveTo(pts[0].x - originX, pts[0].y - originY);
        for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x - originX, pts[i].y - originY);
        if (n > 2) ctx.closePath();
        return;
    }
    const edgeMid = (i) => {
        const j = (i + 1) % n;
        return {
            x: (pts[i].x + pts[j].x) * 0.5 - originX,
            y: (pts[i].y + pts[j].y) * 0.5 - originY,
        };
    };
    const m0 = edgeMid(0);
    ctx.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
        const v = (i + 1) % n;
        const m = edgeMid(v);
        ctx.quadraticCurveTo(
            pts[v].x - originX, pts[v].y - originY,
            m.x, m.y,
        );
    }
    ctx.closePath();
}

function traceBalloonPath(ctx, pts, originX = 0, originY = 0) {
    if (Config.BALLOON_SMOOTH_OUTLINE) {
        traceSmoothBalloonOutline(ctx, pts, originX, originY);
    } else {
        traceBalloonOutline(ctx, pts, originX, originY);
    }
}

/** Renderer */
export class Renderer {
    constructor(game) {
        this.game = game;
        this.luckIconImage = new Image();
        this.luckIconImage.decoding = 'async';
        this.luckIconImage.addEventListener('load', () => this._bakeIconCanvas(this.luckIconImage), { once: true });
        this.luckIconImage.src = `${Config.ASSET_ROOT}luck.png`;
        if (this.luckIconImage.complete && this.luckIconImage.naturalWidth) {
            this._bakeIconCanvas(this.luckIconImage);
        }

        this.clownIconImage = new Image();
        this.clownIconImage.decoding = 'async';
        this.clownIconImage.addEventListener('load', () => this._bakeIconCanvas(this.clownIconImage), { once: true });
        this.clownIconImage.src = `${Config.ASSET_ROOT}${CLOWN_ICON_FILE}`;
        if (this.clownIconImage.complete && this.clownIconImage.naturalWidth) {
            this._bakeIconCanvas(this.clownIconImage);
        }

        /** @type {Map<string, CanvasGradient>} */
        this._ballGradientCache = new Map();
        /** @type {Map<string, CanvasGradient>} */
        this._rainbowBaseGradientCache = new Map();
        /** @type {Map<string, { pad: number, canvas: HTMLCanvasElement }>} */
        this._rainbowOverlayPool = new Map();
        /** @type {string[]} */
        this._rainbowOverlayPoolOrder = [];
    }

    _bakeIconCanvas(img) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;
        try {
        const bake = document.createElement('canvas');
        bake.width = w;
        bake.height = h;
        const bctx = bake.getContext('2d', { willReadFrequently: true });
        bctx.drawImage(img, 0, 0);
        const data = bctx.getImageData(0, 0, w, h);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] <= ICON_ALPHA_CUT) {
                px[i] = 0;
                px[i + 1] = 0;
                px[i + 2] = 0;
                px[i + 3] = 0;
            }
        }
        bctx.putImageData(data, 0, 0);
        img.iconCanvas = bake;
        } catch {
            /* 贴图烘焙失败时仍用原图绘制 */
        }
    }

    _iconDrawable(img) {
        return img?.iconCanvas || img;
    }

    _iconReady(img) {
        if (!img) return false;
        if (img.iconCanvas) return true;
        return img.complete && img.naturalWidth > 0;
    }

    /** 小丑道具统一图标：场上球、嵌套道具、揭晓飞入 */
    drawClownIconAt(cx, cy, ballRadius, opts = {}) {
        const ctx = this.game.dom.ctx;
        const img = this.clownIconImage;
        if (!this._iconReady(img)) return null;
        const source = this._iconDrawable(img);
        const sw = source.width || source.naturalWidth;
        const sh = source.height || source.naturalHeight;
        const sizeMul = opts.sizeMul ?? 1.664;
        const targetH = ballRadius * sizeMul;
        const scale = targetH / sh;
        const iw = sw * scale;
        const ih = sh * scale;
        const x = cx - iw * 0.5;
        const y = cy - ih * 0.5;
        ctx.save();
        if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, sw, sh, x, y, iw, ih);
        ctx.restore();
        return { x, y, w: iw, h: ih };
    }

    drawClownFace(ball, cx, cy) {
        this.drawClownIconAt(cx, cy, ball.radius);
    }

    drawEmbeddedItemIcon(ball, cx, cy) {
        const embedded = ball.embeddedItem;
        if (!embedded?.itemId) return;
        const icon = embedded.def?.icon;
        if (icon === 'clown') {
            this.drawClownIconAt(cx, cy, ball.radius * 0.72);
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
        const rgb = this._sampleRainbowSpectrumRgb(spectrum, t);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }

    /** @param {string[]} spectrum */
    _sampleRainbowSpectrumRgb(spectrum, t) {
        return sampleRainbowRgbAt(t);
    }

    _rainbowOverlayCacheKey(ball, r, simTime) {
        const rKey = Math.max(
            Config.MIN_BALLOON_RADIUS,
            Math.min(Config.MAX_BALLOON_RADIUS, Math.round(r / 4) * 4),
        );
        const phase = (simTime * 0.2 + (ball.rainbowHueOffset ?? 0) * 0.002) % 1;
        const phaseKey = Math.floor(phase * RAINBOW_OVERLAY_PHASE_BUCKETS);
        const hueKey = Math.floor((ball.rainbowHueOffset ?? 0) * 0.05);
        return `${rKey}|${phaseKey}|${hueKey}`;
    }

    _phaseFromOverlayKey(phaseKey, hueKey) {
        let phase = (phaseKey + 0.5) / RAINBOW_OVERLAY_PHASE_BUCKETS;
        phase += (hueKey * 20 + 10) * 0.002;
        return phase % 1;
    }

    _touchRainbowPoolKey(key) {
        const order = this._rainbowOverlayPoolOrder;
        const idx = order.indexOf(key);
        if (idx >= 0) order.splice(idx, 1);
        order.push(key);
    }

    _evictRainbowPoolIfNeeded() {
        while (this._rainbowOverlayPoolOrder.length > RAINBOW_OVERLAY_POOL_MAX) {
            const old = this._rainbowOverlayPoolOrder.shift();
            if (old) this._rainbowOverlayPool.delete(old);
        }
    }

    /** 全局共享半球彩虹纹理（多球同规格复用，降分辨率烘焙） */
    _getSharedRainbowOverlay(ball, r, simTime) {
        const key = this._rainbowOverlayCacheKey(ball, r, simTime);
        let entry = this._rainbowOverlayPool.get(key);
        if (entry) {
            this._touchRainbowPoolKey(key);
            return entry;
        }

        const parts = key.split('|');
        const rKey = Number(parts[0]);
        const phaseKey = Number(parts[1]);
        const hueKey = Number(parts[2]);
        const phase = this._phaseFromOverlayKey(phaseKey, hueKey);

        const pad = Math.ceil(rKey * 1.28);
        const lw = pad * 2;
        const bw = Math.max(8, Math.round(lw * RAINBOW_OVERLAY_PIXEL_SCALE));
        const bh = bw;
        const layer = document.createElement('canvas');
        layer.width = bw;
        layer.height = bh;
        const lctx = layer.getContext('2d', { alpha: true });
        const img = lctx.createImageData(bw, bh);
        const data = img.data;
        const invR = 1 / Math.max(rKey, 1);
        const toLogical = lw / bw;
        const padS = pad * (bw / lw);
        const twoPi = Math.PI * 2;

        for (let py = 0; py < bh; py++) {
            const dy = (py - padS) * toLogical * invR;
            for (let px = 0; px < bw; px++) {
                const dx = (px - padS) * toLogical * invR;
                const d2 = dx * dx + dy * dy;
                if (d2 > 1.02) continue;
                const dz = Math.sqrt(Math.max(0, 1 - d2));
                const lon = Math.atan2(dx, dz);
                let u = ((lon / twoPi + 0.5) * RAINBOW_BAND_REPEATS + phase) % 1;
                if (u < 0) u += 1;
                const rgb = sampleRainbowRgbAt(u);
                const idx = (py * bw + px) * 4;
                data[idx] = rgb[0];
                data[idx + 1] = rgb[1];
                data[idx + 2] = rgb[2];
                data[idx + 3] = 255;
            }
        }
        lctx.putImageData(img, 0, 0);
        entry = { pad, canvas: layer };
        this._rainbowOverlayPool.set(key, entry);
        this._touchRainbowPoolKey(key);
        this._evictRainbowPoolIfNeeded();
        return entry;
    }

    _getRainbowBaseGradient(ctx, r) {
        const rKey = Math.round(r / 4) * 4;
        const key = `base|${rKey}`;
        let grad = this._rainbowBaseGradientCache.get(key);
        if (!grad) {
            grad = ctx.createRadialGradient(
                -rKey * 0.32, -rKey * 0.32, rKey * 0.08,
                0, 0, rKey * 1.08,
            );
            grad.addColorStop(0, '#f8f8fb');
            grad.addColorStop(0.55, '#e8e9ef');
            grad.addColorStop(1, '#c9cad4');
            this._rainbowBaseGradientCache.set(key, grad);
        }
        return grad;
    }

    /**
     * 按正面半球经纬采样：色带沿球面弯曲，缓慢环向平移（非直线条纹）
     */
    _paintSphericalRainbowOverlay(ctx, ball, cx, cy, r, simTime) {
        const cache = this._getSharedRainbowOverlay(ball, r, simTime);
        const pad = cache.pad;
        const logical = pad * 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(
            cache.canvas,
            cx - pad, cy - pad, logical, logical,
        );
    }

    _getBallFillGradient(ctx, colorLight, colorBase, radius) {
        const rKey = Math.round(radius * 2) / 2;
        const key = `${colorLight}|${colorBase}|${rKey}`;
        let grad = this._ballGradientCache.get(key);
        if (!grad) {
            grad = ctx.createRadialGradient(
                -rKey * 0.3, -rKey * 0.3, rKey * 0.1,
                0, 0, rKey * 1.1,
            );
            grad.addColorStop(0, colorLight);
            grad.addColorStop(1, colorBase);
            this._ballGradientCache.set(key, grad);
        }
        return grad;
    }

    /** 灰白底 + 70% 透明球面环向彩虹（路径需已 closePath） */
    drawRainbowBalloonFill(ctx, ball, cx, cy) {
        const game = this.game;
        const r = ball.radius;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = this._getRainbowBaseGradient(ctx, r);
        ctx.fill();
        ctx.restore();

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

        const source = this._iconDrawable(img);
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

        game.drawClownIconAt(cx, cy, radius);
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
            const fontKey = Math.round(fontSize * 20);
            const measureCache = ball._labelMeasureCache;
            let textW;
            if (
                measureCache
                && measureCache.airLabel === airLabel
                && measureCache.fontKey === fontKey
            ) {
                textW = measureCache.textW;
            } else {
                textW = ctx.measureText(airLabel).width;
                ball._labelMeasureCache = { airLabel, fontKey, textW };
            }
            const maxW = ball.radius * 1.55;
            if (textW > maxW) {
                fontSize *= maxW / textW;
                ctx.font = `bold ${fontSize}px "ZCOOL KuaiLe", system-ui, sans-serif`;
                textW = ctx.measureText(airLabel).width;
                ball._labelMeasureCache = {
                    airLabel,
                    fontKey: Math.round(fontSize * 20),
                    textW,
                };
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

                if (isRainbowBall(ball)) {
                    ctx.beginPath();
                    traceBalloonPath(ctx, pts);
                    game.drawRainbowBalloonFill(ctx, ball, cx, cy);
                } else {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.beginPath();
                    traceBalloonPath(ctx, pts, cx, cy);
                    ctx.fillStyle = this._getBallFillGradient(
                        ctx, ball.colorLight, ball.colorBase, ball.radius,
                    );
                    ctx.fill();
                    ctx.restore();
                }

                if (!isClownBall(ball) && !isRainbowBall(ball)) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
                    ctx.beginPath();
                    ctx.ellipse(
                        cx - ball.radius * 0.4, cy - ball.radius * 0.4,
                        ball.radius * 0.22, ball.radius * 0.13, -Math.PI / 4, 0, Math.PI * 2
                    );
                    ctx.fill();
                    if (ball.imminentPopDelay != null) {
                        game.drawImminentPopBallFx(ball, cx, cy);
                    }
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
                const r = fx.r ?? parseInt(fx.color.slice(1, 3), 16);
                const g = fx.g ?? parseInt(fx.color.slice(3, 5), 16);
                const b = fx.b ?? parseInt(fx.color.slice(5, 7), 16);
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
            game.drawFieldItemHint(ctx);
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
