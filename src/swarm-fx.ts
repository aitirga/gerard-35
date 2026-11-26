import * as pc from 'playcanvas';
import type { Effects } from './effects.ts';
import { createPhysarum, PHYSARUM, type Physarum } from './physarum.ts';

/**
 * Enjambre's network (docs/animas/tecnopata/README.md § Look, Aitor 2026-11-25: «red de rastro»): Bip's swarm comes down on
 * the floor among the foes and grows there as a slime mould does, a Physarum network (src/physarum.ts) that reaches out
 * to every foe, holds on to each and thins to the paths that join them. Then a white pulse runs along it from where it
 * landed (the clocks starting over), and it stays, beating red with the bombs, until the last of them has gone off.
 *
 * - **`SWARM.land`**: the swarm reaches the floor (`start`); the network grows from there, fed at every foe's feet.
 * - **`SWARM.hold`**: it has every foe; it thins.
 * - **`SWARM.pulse`**: a white pulse runs out along it.
 * - **Then**: it stays, still alive (a slower step), and beats red each time the bombs flash (`beat`), until they have all
 *   gone off (`release`); then it fades.
 *
 * Cyan, white and graphite, red only in its beat; never violet (docs/visual-style.md). WebGPU only; the CPU places it, says
 * the time and how many steps.
 */
export const SWARM = {
  /** Seconds from the start of the action: the swarm reaches the floor, the network holds every foe, the pulse runs, and how long it takes. */
  land: .8, hold: 1.4, pulse: 1.9, pulseFor: .5,
  /** Metres round the foes and the landing the network's square takes in, and the landing disc's radius. */
  margin: 1.4, disc: .45,
  /** Pairs of steps a second while it grows and while it stays, and the most a frame (a slow frame grows it slower). */
  growRate: 150, stayRate: 60, most: 4,
  /** Seconds it takes to fade once the bombs have gone (however long they tick: a Rayo de energía or Telemetría keeps them, and it, going). */
  fade: .6,
  /** Its colours (sRGB). */
  cyan: '#4fe0ff', white: '#effcff', graphite: '#2a3138', red: '#ff3b30',
} as const;

type V3 = { x: number; y: number; z: number };
/** What the network needs: where the swarm lands (on the floor) and each foe's feet and size (m). */
export interface SwarmCast { land: V3; foes: { at: V3; radius: number }[] }

/** The square of floor the network covers: its corner (least x and z) and its side (m). */
export function swarmDomain(cast: SwarmCast) {
  const xs = [cast.land.x, ...cast.foes.map(f => f.at.x)], zs = [cast.land.z, ...cast.foes.map(f => f.at.z)];
  const side = Math.max(3, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + SWARM.margin * 2;
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 - side / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 - side / 2, side };
}

const VERTEX = /* wgsl */ `
attribute vertex_position: vec3f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
varying vUv: vec2f;
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.vUv = vertex_position.xz * 0.5 + vec2f(0.5);
  output.position = uniform.matrix_viewProjection * (uniform.matrix_model * vec4f(vertex_position, 1.0));
  return output;
}`;
/**
 * The network laid on the floor. `uSwarmLook`: x how much of it shows (0–1), y the pulse's front (uv from the landing, below
 * 0 none), z the red beat (0–1), w a texel in uv. `uSwarmLand`: the landing in uv.
 */
const FRAGMENT = /* wgsl */ `
#include "gammaPS"
#include "tonemappingPS"
varying vUv: vec2f;
uniform uSwarmLook: vec4f;
uniform uSwarmLand: vec4f;
var uTrail: texture_2d<f32>;
var uTrailSampler: sampler;
fn rd(uv: vec2f) -> vec4f { return textureSampleLevel(uTrail, uTrailSampler, uv, 0.0); }
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  let uv = vUv;
  let shown = uniform.uSwarmLook.x;
  let px = uniform.uSwarmLook.w;
  let s = rd(uv);
  // The veins: thin where few agents go, thick and bright where the most do.
  let haze = smoothstep(0.15, 1.2, s.x);
  let vein = smoothstep(0.8, 4.5, s.x);
  let core = smoothstep(16.0, 30.0, s.x);
  // A thin dark edge round each vein (graphite), so it reads on any floor.
  let around = smoothstep(0.4, 2.0, max(max(rd(uv + vec2f(px * 2.0, 0.0)).x, rd(uv - vec2f(px * 2.0, 0.0)).x), max(rd(uv + vec2f(0.0, px * 2.0)).x, rd(uv - vec2f(0.0, px * 2.0)).x)));
  let food = s.y;
  // The pulse: a white band running out from the landing, only along the veins.
  let far = length(uv - uniform.uSwarmLand.xy);
  let front = uniform.uSwarmLook.y;
  let band = select(0.0, exp(-pow((far - front) / 0.035, 2.0)), front >= 0.0);
  let beat = uniform.uSwarmLook.z;
  let edge = 1.0 - smoothstep(0.4, 0.5, max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  let cyan = vec3f(0.08, 0.74, 1.0);
  let white = vec3f(0.94, 0.99, 1.0);
  let red = vec3f(1.0, 0.12, 0.08);
  let graphite = vec3f(0.06, 0.08, 0.1);
  let hue = mix(mix(cyan, white, core), red, beat * 0.85);
  let glow = hue * (haze * 0.12 + vein * 0.9 + core * 1.5 + food * 0.1) + white * band * max(vein, haze * 0.4) * 3.5 + red * beat * vein * 1.6;
  let alpha = clamp(max(around * 0.45, vein * 0.75), 0.0, 1.0) * shown * edge;
  output.color = vec4f(gammaCorrectOutput(toneMap(graphite)) * alpha + gammaCorrectOutput(toneMap(glow)) * shown * edge, alpha);
  return output;
}`;

/** Enjambre's network, on the fight's engine (`effects.gpu`, WebGPU). `start` it as the swarm lands, `update` each frame. */
export function createSwarmFx(app: pc.AppBase, effects: Effects) {
  const device = app.graphicsDevice;
  const gpu = () => effects.gpu && effects.gpu.active ? effects.gpu : undefined;
  let made: { net: Physarum; sheet: pc.Entity; look: Float32Array; land: Float32Array } | undefined;
  function make() {
    const net = createPhysarum(device);
    const mesh = new pc.Mesh(device);
    mesh.setPositions(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]));
    mesh.setIndices([0, 2, 1, 0, 3, 2]); mesh.update();
    const material = new pc.ShaderMaterial({ uniqueName: 'gerard-enjambre-red', attributes: { vertex_position: pc.SEMANTIC_POSITION }, vertexWGSL: VERTEX, fragmentWGSL: FRAGMENT });
    material.name = 'Red de Enjambre'; material.blendType = pc.BLEND_PREMULTIPLIED; material.depthWrite = false; material.cull = pc.CULLFACE_NONE; material.update();
    const instance = new pc.MeshInstance(mesh, material);
    instance.cull = false;
    const look = new Float32Array(4), land = new Float32Array(4);
    instance.setParameter('uTrail', net.trail); instance.setParameter('uSwarmLook', look); instance.setParameter('uSwarmLand', land);
    const sheet = new pc.Entity('Red de Enjambre');
    sheet.addComponent('render', { meshInstances: [instance], castShadows: false, receiveShadows: false });
    sheet.enabled = false;
    app.root.addChild(sheet);
    return { net, sheet, look, land };
  }
  /** Seconds since the swarm landed, the red beat, and how far it has faded once let go (undefined: still held). */
  let time = 0, beat = 0, fading: number | undefined, on = false;
  let owed = 0;
  const api = {
    /** Whether the network is on the floor now. */
    get on() { return on; },
    /** The swarm lands at `cast.land`: the network starts over and grows to every foe. Nothing without the GPU engine. */
    start(cast: SwarmCast) {
      if (!gpu() || !device.supportsCompute || !cast.foes.length) return false;
      made ??= make();
      const d = swarmDomain(cast), texel = (p: V3) => ({ x: (p.x - d.x) / d.side * PHYSARUM.size, y: (p.z - d.z) / d.side * PHYSARUM.size });
      const metre = PHYSARUM.size / d.side, l = texel(cast.land);
      made.net.reset(l, SWARM.disc * metre, [
        { ...l, r: SWARM.disc * .6 * metre },
        ...cast.foes.slice(0, PHYSARUM.sources - 1).map(f => ({ ...texel(f.at), r: Math.max(.3, f.radius * .8) * metre })),
      ]);
      const floor = Math.max(cast.land.y, ...cast.foes.map(f => f.at.y));
      made.sheet.setPosition(d.x + d.side / 2, floor + .035, d.z + d.side / 2);
      made.sheet.setLocalScale(d.side / 2, 1, d.side / 2);
      made.sheet.enabled = true;
      made.land.set([l.x / PHYSARUM.size, l.y / PHYSARUM.size, 0, 0]);
      time = 0; beat = 0; fading = undefined; on = true; owed = 0;
      return true;
    },
    /** The bombs flash: the network beats red with them (`strength` 0–1). */
    beat(strength = 1) { if (on) beat = Math.max(beat, strength); },
    /** The bombs have all gone off (or their foes fell): the network fades. */
    release() { if (on && fading === undefined) fading = 0; },
    /** Each frame: its steps for `dt` seconds, the pulse and the beat, and the fade at the end. */
    update(dt: number) {
      if (!on || !made) return;
      if (!gpu()) { api.clear(); return; }
      time += dt;
      const growing = time < SWARM.pulse + SWARM.pulseFor - SWARM.land;
      owed += dt * (growing ? SWARM.growRate : SWARM.stayRate);
      const pairs = Math.min(SWARM.most, Math.floor(owed));
      owed = Math.min(owed - pairs, SWARM.most);
      // Growing it steps fast; once it holds every foe, slower: alive, it keeps its shape.
      made.net.step(pairs);
      beat = Math.max(0, beat - dt * 3.2);
      if (fading !== undefined) fading += dt;
      const since = time - (SWARM.pulse - SWARM.land), shown = Math.min(1, time / .25) * (fading === undefined ? 1 : Math.max(0, 1 - fading / SWARM.fade));
      made.look[0] = shown;
      made.look[1] = since >= 0 && since < SWARM.pulseFor ? since / SWARM.pulseFor * .75 : -1;
      made.look[2] = beat;
      made.look[3] = 1 / PHYSARUM.size;
      if (fading !== undefined && fading >= SWARM.fade) api.clear();
    },
    /** Gone at once (the fight is over). */
    clear() { on = false; if (made) made.sheet.enabled = false; },
    destroy() { if (!made) return; made.sheet.destroy(); made.net.destroy(); made = undefined; on = false; },
  };
  return api;
}
export type SwarmFx = ReturnType<typeof createSwarmFx>;
