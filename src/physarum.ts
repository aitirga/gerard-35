import * as pc from 'playcanvas';

/**
 * Physarum polycephalum on the GPU (docs/graphics.md § Physarum): the slime mould's transport network, after J. Jones,
 * «Characteristics of pattern formation and evolution in approximations of Physarum transport networks» (Artificial
 * Life 16, 2010). Every agent is a particle that smells the trail ahead of it with three sensors (left, front, right),
 * turns towards the strongest, steps, and leaves a little trail where it lands; the trail spreads and fades. Fed at a few
 * points (food), the agents gather into a network that joins them, and as it fades where few go it thins to the paths
 * that carry the most: close to the shortest tree that joins them.
 *
 * All of it is compute in WGSL: the agents in a storage buffer, their deposits in a buffer of atomic counters, the trail
 * in two textures (ping-pong). The CPU only says where the food is and how many steps to take. WebGPU only.
 */
export const PHYSARUM = {
  /** The trail's texels a side, and how many agents walk it. */
  size: 512, agents: 65536,
  /** Jones's numbers, in texels and radians: the sensors' angle and reach, the turn, the step. */
  sensorAngle: .7, sensorReach: 11, turn: .5, step: 1.3,
  /** What each agent leaves, how much of the trail stays a step, how much of it spreads, and the most a texel holds. */
  deposit: .7, decay: .9, spread: .45, most: 30,
  /** What food smells of: a texel inside it holds at least this much. */
  food: 20,
  /** Food sources at most (the foes and where the swarm lands). */
  sources: 8,
} as const;

const P = PHYSARUM;
const HASH = /* wgsl */ `
fn hashU(n: u32) -> u32 { var x = n; x = x ^ (x >> 16u); x = x * 0x7feb352du; x = x ^ (x >> 15u); x = x * 0x846ca68bu; x = x ^ (x >> 16u); return x; }
fn rand(n: u32) -> f32 { return f32(hashU(n) & 0xffffffu) / 16777216.0; }`;

/**
 * One step of every agent: sense, turn, step, deposit. `uRun`: x 1 on a cast's first step (the agents start over in a
 * disc round the landing), y a seed for this step, z how many agents walk (the rest wait where they are), w unused.
 * `uLand`: where the swarm lands (texels), the disc's radius (texels).
 */
const AGENT_STEP = /* wgsl */ `
var uTrail: texture_2d<f32>;
var<storage, read_write> agents: array<vec4f>;
var<storage, read_write> deposits: array<atomic<u32>>;
uniform uRun: vec4f;
uniform uLand: vec4f;
const N: i32 = ${P.size};
const COUNT: u32 = ${P.agents}u;
const SENSOR_ANGLE: f32 = ${P.sensorAngle};
const SENSOR_REACH: f32 = ${P.sensorReach}.0;
const TURN: f32 = ${P.turn};
const STEP: f32 = ${P.step};
const TAU: f32 = 6.2831853;
${HASH}
fn smell(p: vec2f, heading: f32) -> f32 {
  let q = p + vec2f(cos(heading), sin(heading)) * SENSOR_REACH;
  return textureLoad(uTrail, clamp(vec2i(q), vec2i(0), vec2i(N - 1)), 0).x;
}
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= COUNT) { return; }
  let seed = u32(uniform.uRun.y);
  if (uniform.uRun.x > 0.5) {
    // Landed: a disc round where the swarm came down, each agent heading out from its middle.
    let r = sqrt(rand(i * 3u + 11u)) * uniform.uLand.z;
    let a = rand(i * 3u + 29u) * TAU;
    agents[i] = vec4f(uniform.uLand.xy + vec2f(cos(a), sin(a)) * r, a + (rand(i * 3u + 47u) - 0.5) * 0.8, 0.0);
    return;
  }
  if (f32(i) >= uniform.uRun.z) { return; }
  var agent = agents[i];
  var p = agent.xy;
  var heading = agent.z;
  let ahead = smell(p, heading);
  let toLeft = smell(p, heading + SENSOR_ANGLE);
  let toRight = smell(p, heading - SENSOR_ANGLE);
  let luck = rand(i ^ hashU(seed));
  if (ahead > toLeft && ahead > toRight) {
  } else if (ahead < toLeft && ahead < toRight) {
    heading += select(-TURN, TURN, luck > 0.5);
  } else if (toLeft > toRight) {
    heading += TURN;
  } else if (toRight > toLeft) {
    heading -= TURN;
  } else {
    heading += (luck - 0.5) * TURN;
  }
  p += vec2f(cos(heading), sin(heading)) * STEP;
  // At the edge it turns back the way it came.
  let lo = 2.0; let hi = f32(N) - 3.0;
  if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) {
    p = clamp(p, vec2f(lo), vec2f(hi));
    heading += 3.14159265 + (luck - 0.5);
  }
  agents[i] = vec4f(p, heading, agent.w);
  let cell = vec2i(p);
  atomicAdd(&deposits[u32(cell.y * N + cell.x)], 1u);
}`;

/**
 * The trail, a step: what the agents left (read and cleared at once), spread over its neighbours and faded, and the food
 * held where it is. `uRun`: x 1 on a cast's first step (all clear). `uFoodN`: a source's middle and radius (texels), 1 if it is there.
 */
const TRAIL_STEP = /* wgsl */ `
var uSrc: texture_2d<f32>;
var uDst: texture_storage_2d<rgba16float, write>;
var<storage, read_write> deposits: array<atomic<u32>>;
uniform uRun: vec4f;
${Array.from({ length: P.sources }, (_, i) => `uniform uFood${i}: vec4f;`).join('\n')}
const N: i32 = ${P.size};
const DEPOSIT: f32 = ${P.deposit};
const DECAY: f32 = ${P.decay};
const SPREAD: f32 = ${P.spread};
const MOST: f32 = ${P.most}.0;
const FOOD: f32 = ${P.food}.0;
fn foodAt(i: i32) -> vec4f {
  switch i {
${Array.from({ length: P.sources - 1 }, (_, i) => `    case ${i}: { return uniform.uFood${i}; }`).join('\n')}
    default: { return uniform.uFood${P.sources - 1}; }
  }
}
fn trailAt(q: vec2i) -> f32 { return textureLoad(uSrc, clamp(q, vec2i(0), vec2i(N - 1)), 0).x; }
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (q.x >= N || q.y >= N) { return; }
  let left = f32(atomicExchange(&deposits[u32(q.y * N + q.x)], 0u));
  if (uniform.uRun.x > 0.5) { textureStore(uDst, q, vec4f(0.0)); return; }
  var sum = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) { sum += trailAt(q + vec2i(x, y)); } }
  let here = trailAt(q);
  var v = mix(here, sum / 9.0, SPREAD) * DECAY + left * DEPOSIT;
  let qf = vec2f(q);
  var fed = 0.0;
  for (var i = 0; i < ${P.sources}; i++) {
    let f = foodAt(i);
    if (f.w < 0.5) { continue; }
    let d = length(qf - f.xy);
    if (d < f.z) { fed = max(fed, 1.0 - d / f.z); }
  }
  v = min(MOST, max(v, fed * FOOD));
  // y: the food itself (the network's ends), for the sheet.
  textureStore(uDst, q, vec4f(v, fed, 0.0, 1.0));
}`;

/** A Physarum network: its agents, its trail, and the steps that move them. */
export function createPhysarum(device: pc.GraphicsDevice) {
  const texture = (name: string) => new pc.Texture(device, {
    name, width: P.size, height: P.size, format: pc.PIXELFORMAT_RGBA16F, mipmaps: false, storage: true,
    minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  const a = texture('Physarum A'), b = texture('Physarum B');
  const agents = new pc.StorageBuffer(device, P.agents * 16);
  const deposits = new pc.StorageBuffer(device, P.size * P.size * 4);
  const agentShader = new pc.Shader(device, { name: 'Physarum · agentes', shaderLanguage: pc.SHADERLANGUAGE_WGSL, cshader: AGENT_STEP });
  const trailShader = new pc.Shader(device, { name: 'Physarum · rastro', shaderLanguage: pc.SHADERLANGUAGE_WGSL, cshader: TRAIL_STEP });
  const walk = (trail: pc.Texture, name: string) => {
    const c = new pc.Compute(device, agentShader, name);
    c.setParameter('uTrail', trail); c.setParameter('agents', agents); c.setParameter('deposits', deposits);
    c.setupDispatch(Math.ceil(P.agents / 64), 1, 1);
    return c;
  };
  const spread = (from: pc.Texture, to: pc.Texture, name: string) => {
    const c = new pc.Compute(device, trailShader, name);
    c.setParameter('uSrc', from); c.setParameter('uDst', to); c.setParameter('deposits', deposits);
    const groups = Math.ceil(P.size / 8);
    c.setupDispatch(groups, groups, 1);
    return c;
  };
  // A step reads the trail in a and leaves it in b, the next the other way: after an even number of steps it is in a.
  const steps = [walk(a, 'Physarum agentes a'), spread(a, b, 'Physarum rastro a→b'), walk(b, 'Physarum agentes b'), spread(b, a, 'Physarum rastro b→a')];
  const walks = [steps[0], steps[2]], spreads = [steps[1], steps[3]];
  let fresh = true, seed = 1;
  return {
    /** The trail as it stands after the last even step (x: the trail, y: the food). */
    trail: a,
    /**
     * Starts over: the agents come down in a disc of `radius` texels round `land`, and the food is at `food` (texels and
     * radius). The next `step` clears the trail and places the agents.
     */
    reset(land: { x: number; y: number }, radius: number, food: { x: number; y: number; r: number }[]) {
      fresh = true;
      for (const c of walks) c.setParameter('uLand', [land.x, land.y, radius, 0]);
      for (const c of spreads) for (let i = 0; i < P.sources; i++) { const f = food[i]; c.setParameter(`uFood${i}`, f ? [f.x, f.y, f.r, 1] : [0, 0, 0, 0]); }
    },
    /** `pairs` pairs of steps (agents, then trail, twice), with `walking` agents moving; in one compute pass. */
    step(pairs: number, walking: number = P.agents) {
      if (pairs <= 0) return;
      const list: pc.Compute[] = [];
      for (let i = 0; i < pairs; i++) {
        for (let k = 0; k < 2; k++) {
          const first = fresh && i === 0;
          // The first pair on a cast places the agents and clears the trail (both halves, so b is clear too).
          walks[k].setParameter('uRun', [first ? 1 : 0, seed++ % 65536, walking, 0]);
          spreads[k].setParameter('uRun', [first ? 1 : 0, 0, 0, 0]);
          list.push(walks[k], spreads[k]);
        }
        // Uniforms are copied when each compute is dispatched in its turn: one pass per pair keeps each its own.
        device.computeDispatch(list.splice(0), 'Physarum');
        fresh = false;
      }
    },
    destroy() { steps.forEach(c => c.destroy()); a.destroy(); b.destroy(); agents.destroy(); deposits.destroy(); },
  };
}
export type Physarum = ReturnType<typeof createPhysarum>;
