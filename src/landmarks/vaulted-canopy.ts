import type { GeoLandmark } from '../geo';
import type { LandmarkKit } from '../landmarks';

/**
 * A white concrete canopy along a shop front, made of a row of shallow barrel vaults whose ends
 * show as scallops: Hipercor's on the Meridiana (docs/places/meridiana.md). The footprint's back
 * edge (-z) is the wall, its front (+z) the street. `vault_m` is each vault's span, `height_m`
 * the underside at its lowest, `rise_m` how much each vault arches, `colour` the concrete.
 */
export const kind = 'vaulted-canopy';

export function build(kit: LandmarkKit, landmark: GeoLandmark) {
  const width = landmark.w * kit.cell, depth = landmark.d * kit.cell;
  const span = Number(landmark.params.vault_m ?? 6), low = Number(landmark.params.height_m ?? 3);
  const rise = Number(landmark.params.rise_m ?? 0.5), thick = 0.45;
  const concrete = kit.surface('formigo', String(landmark.params.colour ?? '#ecebe6'), 0.12);
  const vaults = Math.max(1, Math.round(width / span)), step = width / vaults, segments = 8;
  const shell = kit.mesh();
  const z0 = -depth / 2, z1 = depth / 2;
  for (let v = 0; v < vaults; v++) for (let s = 0; s < segments; s++) {
    // Each vault arches up across its span: the top a barrel, the front a scallop of even thickness.
    const xa = -width / 2 + v * step + s * step / segments, xb = xa + step / segments;
    const ya = low + rise * Math.sin(Math.PI * s / segments), yb = low + rise * Math.sin(Math.PI * (s + 1) / segments);
    shell.quad([xa, ya + thick, z0], [xb, yb + thick, z0], [xb, yb + thick, z1], [xa, ya + thick, z1], [0, 1, 0], [xa, z0], [xb, z0], [xb, z1], [xa, z1]);
    shell.quad([xa, ya, z1], [xb, yb, z1], [xb, yb + thick, z1], [xa, ya + thick, z1], [0, 0, 1], [xa, ya], [xb, yb], [xb, yb + thick], [xa, ya + thick]);
    shell.quad([xa, ya, z0], [xb, yb, z0], [xb, yb, z1], [xa, ya, z1], [0, -1, 0], [xa, z0], [xb, z0], [xb, z1], [xa, z1]);
  }
  for (const side of [-1, 1]) {
    const x = side * width / 2;
    shell.quad([x, low, z0], [x, low, z1], [x, low + thick, z1], [x, low + thick, z0], [side, 0, 0], [z0, low], [z1, low], [z1, low + thick], [z0, low + thick]);
  }
  // Walking under it, Gerard would be hidden from the high camera: it opens the cut like a building.
  kit.add('Marquesina ondulada', shell, concrete, { cut: true });
}
