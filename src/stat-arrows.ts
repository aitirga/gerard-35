import * as pc from 'playcanvas';
import { CHEVRONS, STAT_LOOKS, chevronPose, type StatWay } from './stat-fx';

/**
 * The chevrons of a stat going up or down (src/stat-fx.ts `chevronPose`, docs/graphics.md § Stats
 * going up or down): three flat chevrons, each with a dark outline so it reads on any floor, pass in
 * front of the fighter facing the camera, one after another, up in blue or down in red. Unlit, so
 * they keep their colour in any light.
 */
export function createStatArrows(app: pc.Application, parent: pc.Entity) {
  const device = app.graphicsDevice;
  /** A chevron pointing up (or down), `w` wide, its point `h` over its arms, `t` thick, flat in x–y. */
  function chevron(down: boolean) {
    const w = .5, h = .3, t = .13, s = down ? -1 : 1;
    // Outer edge then inner edge, left to right: a V upside down (an arrowhead).
    const p = [[-w, -h / 2], [0, h / 2], [w, -h / 2], [w, -h / 2 - t], [0, h / 2 - t], [-w, -h / 2 - t]].map(([x, y]) => [x, y * s, 0]);
    const mesh = new pc.Mesh(device);
    mesh.setPositions(p.flat());
    mesh.setNormals(p.flatMap(() => [0, 0, 1]));
    mesh.setIndices(down ? [0, 4, 1, 0, 5, 4, 1, 3, 2, 1, 4, 3] : [0, 1, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4]);
    mesh.update();
    return mesh;
  }
  const meshes = { up: chevron(false), down: chevron(true) };
  // Shared by every chevron: held here, or the first chevron destroyed would free them for the rest
  // (PlayCanvas destroys a mesh when its last mesh instance goes) and the next ones would draw with no
  // vertices: an invalid pipeline that blanks the whole frame.
  meshes.up.incRefCount(); meshes.down.incRefCount();
  const material = (hex: string, intensity: number) => {
    const m = new pc.StandardMaterial();
    m.useLighting = false; m.diffuse.set(0, 0, 0); m.emissive.fromString(hex); m.emissiveIntensity = intensity;
    m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.cull = pc.CULLFACE_NONE; m.opacity = 1;
    m.update();
    return m;
  };
  const OUTLINE = '#160a18';
  interface Live { way: StatWay; start: number; height: number; size: number; feet: pc.Vec3; toward: pc.Vec3; yaw: number; parts: { core: pc.Entity; edge: pc.Entity; coreMat: pc.StandardMaterial; edgeMat: pc.StandardMaterial }[] }
  let live: Live[] = [];
  let time = 0;
  function drop(one: Live) { for (const part of one.parts) { part.core.destroy(); part.edge.destroy(); part.coreMat.destroy(); part.edgeMat.destroy(); } }
  return {
    /**
     * Three chevrons for someone `height` tall and `radius` wide standing at `feet`, starting
     * `delay` seconds from now, facing a camera that looks from `yaw` (degrees round the vertical).
     */
    play(feet: pc.Vec3, way: StatWay, o: { height: number; radius: number; delay?: number; yaw: number }) {
      const toward = new pc.Vec3(Math.sin(o.yaw * pc.math.DEG_TO_RAD), 0, Math.cos(o.yaw * pc.math.DEG_TO_RAD));
      const parts = Array.from({ length: CHEVRONS.count }, () => {
        const look = STAT_LOOKS[way];
        const coreMat = material(look.ring[0], 1.25), edgeMat = material(OUTLINE, 1);
        const make = (name: string, m: pc.StandardMaterial) => {
          const e = new pc.Entity(name);
          e.addComponent('render', { meshInstances: [new pc.MeshInstance(meshes[way], m)], castShadows: false, receiveShadows: false });
          e.enabled = false; parent.addChild(e);
          return e;
        };
        return { core: make('Flecha de característica', coreMat), edge: make('Borde de la flecha', edgeMat), coreMat, edgeMat };
      });
      live.push({ way, start: time + (o.delay ?? 0), height: o.height, size: Math.min(1.25, Math.max(.6, o.radius * 1.15)), feet: feet.clone(), toward, yaw: o.yaw, parts });
    },
    update(dt: number) {
      time += dt;
      live = live.filter(one => {
        const t = time - one.start;
        if (t > CHEVRONS.after + CHEVRONS.stagger * CHEVRONS.count + CHEVRONS.seconds) { drop(one); return false; }
        one.parts.forEach((part, i) => {
          const pose = chevronPose(one.way, i, t, one.height);
          part.core.enabled = part.edge.enabled = !!pose;
          if (!pose) return;
          // In front of them, on the camera's side, so their body never hides it.
          const out = one.size * .55, at = one.feet.clone().add(one.toward.clone().mulScalar(out)).add(new pc.Vec3(0, pose.y, 0));
          const k = pose.scale * one.size;
          part.core.setPosition(at); part.core.setEulerAngles(0, one.yaw, 0); part.core.setLocalScale(k, k, k);
          part.edge.setPosition(at.clone().sub(one.toward.clone().mulScalar(.02))); part.edge.setEulerAngles(0, one.yaw, 0); part.edge.setLocalScale(k * 1.28, k * 1.4, k);
          part.coreMat.opacity = pose.alpha; part.coreMat.update();
          part.edgeMat.opacity = pose.alpha * .8; part.edgeMat.update();
        });
        return true;
      });
    },
    clear() { live.forEach(drop); live = []; },
    destroy() { live.forEach(drop); live = []; meshes.up.destroy(); meshes.down.destroy(); },
  };
}
export type StatArrows = ReturnType<typeof createStatArrows>;
