# Noísta

Status: playable · Comes from: chapter 1's palace (`docs/bubbaloo-palace.md` § The fight and Noísta)

## Identity

- Gerard always contradicts; in the palace, when a minion is about to finish Bernat, he shouts
  "¡NO!" and the habit becomes a power. The natural counter to La Reina Bubbaloo: her minions
  make things obey, Gerard refuses.
- Motto: *"Dice que no. Y el mundo le hace caso."*
- Colour: crimson `#e2483d`.
- Look: the mustard shirt with navy stripes turns crimson with charcoal stripes, charcoal
  trousers, red glasses, a short crimson scarf at the neck.
- Interface: protest-poster style (slanted cards, hard crimson shadow, a faint **NO** watermark,
  stamped heavy italics). Full spec in `docs/bubbaloo-palace.md` § Noísta: look and interface.

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

## Implementation

Built: `noista` in `ClassId`, `CLASS_STATS`, `SKILLS` (`src/battle.ts`), `CLASSES` with look and
scarf (`src/classes.ts`), theme in `src/style.css`, unlocked by the `noista` flag in chapter 1.

To do: its level table once levels exist.

## Open

- What it learns at levels 2 and 3.
