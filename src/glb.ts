import * as pc from 'playcanvas';

/**
 * A GLB model (Meshy's, rigged by `just rig`), loaded once and handed out as a hidden template to
 * clone: the engine's own container loader, its skin and bones as entities named as in the file.
 */
const loaded = new Map<string, Promise<pc.Entity>>();
export function loadGlb(app: pc.AppBase, url: string): Promise<pc.Entity> {
  let model = loaded.get(url);
  if (!model) {
    model = new Promise<pc.Entity>((resolve, reject) => app.assets.loadFromUrl(url, 'container', (error, asset) => {
      if (error || !asset) { reject(error ?? new Error(`No se pudo cargar ${url}`)); return; }
      const entity = (asset.resource as pc.ContainerResource).instantiateRenderEntity();
      entity.enabled = false;
      resolve(entity);
    }));
    model.catch(() => loaded.delete(url));
    loaded.set(url, model);
  }
  return model;
}
