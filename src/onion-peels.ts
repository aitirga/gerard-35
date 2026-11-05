import * as pc from 'playcanvas';

/**
 * The skins an onion sheds in a fight (docs/quests/nuria.md § Monsters): when a layer comes off,
 * curved pieces of it fly away from the blow, tumble, land and curl up to nothing. A few real
 * pieces, not particles: what has to read is "that was a layer". `skinOf` is the colour the onion
 * shows with so many layers on, a different one each time, pale once it has none.
 */
const SKINS = ['#e9c46a', '#d69a3c', '#e2b04f'], NAKED = '#f4e4b4';
export const skinOf = (layers: number) => layers > 0 ? SKINS[layers % SKINS.length] : NAKED;
const LIFE = .95, PIECES = 4;

export function createOnionPeels(root: pc.Entity, groundHeight: (x: number, z: number) => number) {
  const flying: { entity: pc.Entity; material: pc.StandardMaterial; velocity: pc.Vec3; spin: pc.Vec3; age: number; size: pc.Vec3 }[] = [];
  return {
    /** A layer of colour `hex` comes off an onion of `radius` round `centre`; `away` is the way the blow pushes it. */
    shed(centre: pc.Vec3, radius: number, hex: string, away: pc.Vec3) {
      const material = new pc.StandardMaterial();
      material.diffuse.fromString(hex); material.gloss = .55; material.useMetalness = false; material.cull = pc.CULLFACE_NONE; material.update();
      for (let i = 0; i < PIECES; i++) {
        const angle = i / PIECES * Math.PI * 2 + Math.random() * .7;
        const out = new pc.Vec3(Math.cos(angle), .35 + Math.random() * .5, Math.sin(angle)).normalize();
        const entity = new pc.Entity('Capa suelta');
        entity.addComponent('render', { type: 'sphere', material, castShadows: true });
        // A curved scrap of skin: a sphere squashed thin, lying on the onion where it came from.
        const size = new pc.Vec3(radius * (.62 + Math.random() * .2), radius * .55, radius * .12);
        entity.setLocalScale(size);
        entity.setPosition(centre.x + out.x * radius, centre.y + out.y * radius, centre.z + out.z * radius);
        entity.lookAt(centre);
        root.addChild(entity);
        const speed = 1.6 + radius * 1.8 + Math.random() * 1.2;
        flying.push({
          entity, material, age: i * .012, size,
          velocity: new pc.Vec3(out.x * speed + away.x * 1.4, 2 + Math.random() * 1.6 + radius, out.z * speed + away.z * 1.4),
          spin: new pc.Vec3((Math.random() - .5) * 620, (Math.random() - .5) * 620, (Math.random() - .5) * 620),
        });
      }
    },
    update(dt: number) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const peel = flying[i];
        peel.age += dt;
        peel.velocity.y -= 11 * dt;
        const at = peel.entity.getPosition(), floor = groundHeight(at.x, at.z) + .03;
        const y = at.y + peel.velocity.y * dt, landed = y <= floor;
        // On the ground they lie still and curl up.
        if (landed) { peel.velocity.set(0, 0, 0); peel.spin.set(0, 0, 0); }
        peel.entity.setPosition(at.x + peel.velocity.x * dt, landed ? floor : y, at.z + peel.velocity.z * dt);
        peel.entity.rotateLocal(peel.spin.x * dt, peel.spin.y * dt, peel.spin.z * dt);
        const left = 1 - Math.max(0, peel.age - LIFE * .6) / (LIFE * .4);
        peel.entity.setLocalScale(peel.size.x * left, peel.size.y * left, peel.size.z);
        if (peel.age >= LIFE) {
          peel.entity.destroy();
          flying.splice(i, 1);
          if (!flying.some(other => other.material === peel.material)) peel.material.destroy();
        }
      }
    },
    clear() {
      for (const material of new Set(flying.map(peel => peel.material))) material.destroy();
      for (const peel of flying) peel.entity.destroy();
      flying.length = 0;
    },
  };
}
