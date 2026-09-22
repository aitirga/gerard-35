import * as pc from 'playcanvas';

/** Pooled low-poly puffs: they grow, drift and shrink away, so no transparency is needed. */
const KINDS = {
  dust: { color: '#d8ccae', glow: 0, size: .13, life: .55, speed: .5, rise: .35, gravity: 0 },
  poof: { color: '#efe6cf', glow: .15, size: .3, life: .75, speed: 1.3, rise: .8, gravity: 0 },
  spark: { color: '#ffe2a0', glow: 1.4, size: .07, life: .38, speed: 3.6, rise: 1.6, gravity: 7 },
  heal: { color: '#c9eaa8', glow: 1.1, size: .08, life: 1, speed: .45, rise: 1.5, gravity: -.4 },
} as const;
export type EffectKind = keyof typeof KINDS;

interface Particle { entity: pc.Entity; age: number; life: number; size: number; velocity: pc.Vec3; gravity: number; spin: number }

export function createEffects(app: pc.Application, capacity = 72) {
  const root = new pc.Entity('Efectos'); app.root.addChild(root);
  const materials = new Map<EffectKind, pc.StandardMaterial>();
  for (const [kind, spec] of Object.entries(KINDS) as [EffectKind, typeof KINDS[EffectKind]][]) {
    const m = new pc.StandardMaterial(); m.diffuse.fromString(spec.color);
    if (spec.glow) { m.emissive.fromString(spec.color); m.emissiveIntensity = spec.glow; }
    m.update(); materials.set(kind, m);
  }
  const particles: Particle[] = Array.from({ length: capacity }, () => {
    const entity = new pc.Entity('Partícula');
    entity.addComponent('render', { type: 'sphere', castShadows: false, receiveShadows: false });
    entity.enabled = false; root.addChild(entity);
    return { entity, age: 0, life: 0, size: 0, velocity: new pc.Vec3(), gravity: 0, spin: 0 };
  });
  let next = 0;
  return {
    emit(kind: EffectKind, at: pc.Vec3, count = 6, spread = .25) {
      const spec = KINDS[kind];
      for (let i = 0; i < count; i++) {
        const p = particles[next]; next = (next + 1) % particles.length;
        const angle = Math.random() * Math.PI * 2, speed = spec.speed * (.55 + Math.random() * .45);
        p.entity.render!.meshInstances[0].material = materials.get(kind)!;
        p.entity.setPosition(at.x + Math.cos(angle) * spread * Math.random(), at.y, at.z + Math.sin(angle) * spread * Math.random());
        p.velocity.set(Math.cos(angle) * speed, spec.rise * (.6 + Math.random() * .6), Math.sin(angle) * speed);
        p.age = 0; p.life = spec.life * (.75 + Math.random() * .5); p.size = spec.size * (.7 + Math.random() * .6);
        p.gravity = spec.gravity; p.spin = (Math.random() - .5) * 400;
        p.entity.setLocalScale(0, 0, 0); p.entity.enabled = true;
      }
    },
    update(dt: number) {
      for (const p of particles) {
        if (!p.entity.enabled) continue;
        p.age += dt;
        if (p.age >= p.life) { p.entity.enabled = false; continue; }
        const t = p.age / p.life;
        p.velocity.y -= p.gravity * dt;
        p.velocity.mulScalar(Math.exp(-dt * 2.4));
        const position = p.entity.getPosition();
        p.entity.setPosition(position.x + p.velocity.x * dt, position.y + p.velocity.y * dt, position.z + p.velocity.z * dt);
        // Fast bloom, slow shrink: reads as a puff rather than a popping sphere.
        const s = p.size * Math.min(1, t * 6) * (1 - t * t);
        p.entity.setLocalScale(s, s * .85, s);
        p.entity.rotateLocal(0, p.spin * dt, 0);
      }
    },
    clear() { particles.forEach(p => { p.entity.enabled = false; }); },
    destroy() { root.destroy(); materials.forEach(m => m.destroy()); },
  };
}
export type Effects = ReturnType<typeof createEffects>;
