# External assets

Drop source material here. Nothing in this folder is bundled or served: Vite
only ships `index.html`, `src/` and `public/`, so these files stay on your
machine (and in the container image's build context exclusions) unless you
copy an exported result into `public/`.

```
assets/
  references/
    characters/    photos, concept art and turnarounds per character
    environments/  street, facade, garden and interior references
    props/         cars, trees, furniture, signage
  models/          working files and exports from the modelling step
                   (.blend, high-poly GLB, texture bakes)
public/
  models/          game-ready GLB/textures, served at ./models/… at runtime
```

Suggested convention inside `references/`: one folder per subject, e.g.
`characters/gerard/front.jpg`, `characters/gerard/side.jpg`,
`environments/maresme/facade-20.jpg`. The subject name is what ties a reference
to the ids already used in [src/environments.ts](../src/environments.ts) and
the `SPEAKERS` table in [src/dialogue.ts](../src/dialogue.ts).

## Git and privacy

[assets/.gitignore](.gitignore) keeps images, videos and model binaries
untracked by default, because this repository and the deployed site are public
and the references are personal photos of real places and people. The folder
structure, this README and any notes you write are tracked. Remove the matching
line from that file if you deliberately want a given format committed.

## Status

The game currently builds all geometry procedurally in
[src/scenery.ts](../src/scenery.ts) from the typed footprints in
`src/environments.ts`. GLB loading is not implemented yet, so `public/models/`
is an empty destination waiting for that step — see
[docs/environment-pipeline.md](../docs/environment-pipeline.md).

## Gerard portrait

`characters/gerard/portrait-approved.png` preserves the selected portrait.
`characters/gerard/portrait-transparent.png` is its generated transparent cutout.
`characters/gerard/portrait-child-transparent.png` is the child low-poly variant (approximately 8–10, early-2000s clothing)
used by Escenario 1. The game serves it from `public/portraits/gerard-child.png`
for the journal, dialogue, and battle interfaces. The adult portrait remains at
`public/portraits/gerard.png` for later scenarios. Keep each source cutout and
served copy in sync when replacing a portrait. The original reference photos
remain local.
