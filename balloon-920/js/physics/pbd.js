/** PBD 物理约束核心 */

export class Particle {
    constructor(x, y, mass) {
        this.x = x;
        this.y = y;
        this.px = x;
        this.py = y;
        this.vx = 0;
        this.vy = 0;
        this.mass = mass;
        this.invMass = mass > 0 ? 1 / mass : 0;
    }
}

export class DistanceConstraint {
    constructor(p1, p2, stiffness = 1.0) {
        this.p1 = p1;
        this.p2 = p2;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        this.restLength = Math.hypot(dx, dy);
        this.initialRestLength = this.restLength;
        this.stiffness = stiffness;
        this.baseStiffness = stiffness;
    }

    solve() {
        const dx = this.p1.x - this.p2.x;
        const dy = this.p1.y - this.p2.y;
        const d = Math.hypot(dx, dy);
        if (d === 0) return;

        const diff = (d - this.restLength) / d;
        const w1 = this.p1.invMass;
        const w2 = this.p2.invMass;
        const w = w1 + w2;
        if (w === 0) return;

        const corrX = dx * diff * this.stiffness / w;
        const corrY = dy * diff * this.stiffness / w;

        this.p1.x -= corrX * w1;
        this.p1.y -= corrY * w1;
        this.p2.x += corrX * w2;
        this.p2.y += corrY * w2;
    }
}

export class AreaConstraint {
    constructor(particles, stiffness = 1.0) {
        this.particles = particles;
        this.stiffness = stiffness;
        this.restArea = this.calculateArea();
        this.baseRestArea = this.restArea;
    }

    calculateArea() {
        let area = 0;
        const N = this.particles.length;
        for (let i = 0; i < N; i++) {
            const p = this.particles[i];
            const pNext = this.particles[(i + 1) % N];
            area += (p.x * pNext.y - pNext.x * p.y);
        }
        return 0.5 * area;
    }

    solve() {
        const N = this.particles.length;
        const currentArea = this.calculateArea();
        const deltaArea = currentArea - this.restArea;

        let sumWGrad2 = 0;
        const gradients = new Array(N);

        for (let i = 0; i < N; i++) {
            const pNext = this.particles[(i + 1) % N];
            const pPrev = this.particles[(i - 1 + N) % N];
            gradients[i] = {
                x: 0.5 * (pNext.y - pPrev.y),
                y: 0.5 * (pPrev.x - pNext.x)
            };
            const w = this.particles[i].invMass;
            sumWGrad2 += w * (gradients[i].x ** 2 + gradients[i].y ** 2);
        }

        if (sumWGrad2 < 0.00001) return;

        const lambda = -deltaArea / sumWGrad2 * this.stiffness;

        for (let i = 0; i < N; i++) {
            const p = this.particles[i];
            const w = p.invMass;
            p.x += lambda * w * gradients[i].x;
            p.y += lambda * w * gradients[i].y;
        }
    }
}
