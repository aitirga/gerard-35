# Noísta

Status: hidden: retired from the game (2026-11-01), kept as a design to bring back or rework ·
Came from: chapter 1's palace

**Replaced by Matemágico** (`../matemagico/README.md`): the palace beat now wakes Matemágico in
Gerard, and its fire (Foc Binari) melts the pringue that No-ta used to break. The code (`noista`
in `ClassId`, No-ta, the stamp effect, the protest-poster theme) is gone; the story flag
`noista` became `matemagico`. Gerard's waking «¡NO!» in chapter 2 stays, as a nightmare cry. What
follows is the design as it was.

## Identity

- Gerard always contradicts; in the palace, when a minion is about to finish Bernat, he shouts
  "¡NO!" and the habit becomes a power. The natural counter to La Reina Bubbaloo: her minions
  make things obey, Gerard refuses.
- Motto: *"Dice que no. Y el mundo le hace caso."*
- Colour: crimson `#e2483d`.
- Look: the mustard shirt with navy stripes turns crimson with charcoal stripes, charcoal
  trousers, red glasses, a short crimson scarf at the neck.
- Interface: protest-poster style (slanted cards, hard crimson shadow,
  stamped heavy italics). The full spec lived in `docs/bubbaloo-palace.md` (in git history).

## Stats

Magia +2, Espíritu +2, Defensa −1.

## Signature: breaking the pringue

No-ta is the only thing that breaks the Queen's gum shell (pringue).

## Skills per level

| Level | Skill | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| 1 | No-ta | 10 | 40 magic | `Daño alto mágico a un enemigo. Rompe el pringue.` |
| 2+ | _open_ | | | |

## Combined skills

| With | Idea |
| --- | --- |
| Papagato | A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |

On hold with Noísta.

## Implementation

Was built: `noista` in `ClassId`, `CLASS_STATS`, `SKILLS` (`src/battle.ts`), `CLASSES` with look
and scarf (`src/classes.ts`), theme in `src/style.css`, `effects.stamp`, unlocked by the `noista`
flag in chapter 1. All removed on 2026-11-01; git history has it.

## Open

- Whether it comes back, and how: another moment, another wearer, or reworked.
- What it would learn at levels 2 and 3.
