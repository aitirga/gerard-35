# Ánimas

What an ánima is, which ones exist, how they grow and the mechanics they share. Who wears what
and the stats are in `docs/party.md`; the story side (grey ánimas, the second round) in
`docs/lore.md` and `docs/chapter-2.md`. Each ánima is designed with the `/anima` skill.

## This folder

```
docs/animas/
  README.md          this page: the rules every ánima shares, the catalogue, combined skills,
                     shared mechanics, and how an ánima is built in code
  <id>/README.md     one ánima: identity, look, stats, skills per level, its mechanic, combined
                     skills, in the world, second round, implementation status and plan, open
  <id>/…             anything else that ánima needs later (skill VFX notes, references)
```

`<id>` is the ánima's `ClassId` (`matemagico`, `noista`, `papagato`). A friend's mission lives in
`docs/quests/<friend>.md` and links to the ánima it gives.

## Two things called ánima

The word covers two related things; keep them apart when designing:

| | What it is | Code |
| --- | --- | --- |
| **A wearable ánima** | A way of being that someone in the party puts on: a look, a colour, an interface theme, stats and skills. Gerard's power is changing it. | `ClassId`, `CLASSES` (`src/classes.ts`), `CLASS_STATS`, `SKILLS` (`src/battle.ts`) |
| **A friend's ánima** | The small light that leaves a friend when Gerard helps them: a party-wide stat bonus that also weakens the palace guards. | `ANIMAS` (`src/animas.ts`), `anima-<friend>` flags |

Each **person** helped also gives a **light** (a friend's household can give several: Nuria, Uri
and Nil give three). Lights are kept in a jar at home and can be spent for a day against the
Queen (`docs/chapter-2.md` § The Queen's advance). They are not ánimas and carry no stats.

A friend's mission usually gives both: the friend's light, and a wearable ánima that comes from
them (Nuria → Papagato). Player-facing text says *ánima* for both, never *clase*.

## Catalogue

| Ánima | Origin | Colour | Stats (wearer) | Skills | Status |
| --- | --- | --- | --- | --- | --- |
| [**Matemágico**](matemagico/README.md) | Gerard's own, from the start | `#f3cf78` gold | Magia +1, Espíritu +1 | Análisis Parálisis, Cardioide | Playable |
| [**Noísta**](noista/README.md) | Chapter 1's palace: Gerard shouts "¡NO!" | `#e2483d` red | Magia +2, Espíritu +2, Defensa −1 | No-ta | Playable |
| [**Papagato**](papagato/README.md) | Nuria's mission (Cardedeu), `docs/quests/nuria.md` | _open_ | _open_ | Haru and Yuki | Designing |

## Levels

Ánimas **grow**: the more one is worn, the more it learns. Each level brings a new skill or makes
one stronger.

- **Fights won while wearing it** give levels (decided; both wearers count).
- **Story events** can also raise an ánima or teach it something (decided), e.g. the second round
  with its friend.
- How many: proposal, three to four levels per ánima for this game's length.
- Where it shows: the Ánimas page of the status screen (what it has, never what is missing to
  get the next one, per the HUD rule in `AGENTS.md`); a note when a skill is learned.
- Every ánima has its level table in its own folder; Matemágico and Noísta still need theirs.

Nothing of this exists in code yet.

## Combined skills

Some skills need **two ánimas side by side**: when Gerard and Aitor wear different ánimas that
complement each other, a combined skill appears for both (decided as an idea; rules are a
proposal).

- Only for particular pairs, not every combination: each one should feel found, not listed.
- Proposal: it shows in the skill list of both fighters only while the pair is worn; one of them
  uses it on their turn, it spends Secundaria from both and takes the other's next turn too.
- Proposal: a pair learns its combined skill after winning some fights wearing it together, or at
  a story moment; it is never shown before it is learned (HUD rule: only what the party has).
- Works with two players (each one picks their own ánima, so finding a combo is a conversation)
  and in solo debug mode.

| Pair | Combined skill | Idea |
| --- | --- | --- |
| Noísta + Papagato | _name open_ | A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |
| Matemágico + Papagato | _name open_ | Gerard calculates the angle, Haru lands it: a sure hit on the weakest spot |

The pair table lives here; each ánima's folder lists the pairs it is part of and links back.

## Action points (proposal)

An idea under discussion: replace Secundaria with a small pool of points per ánima, full at the
start of each fight and recovering only while the ánima rests, so fights push the player to
change ánima. See `docs/action-points.md`.

## Shared mechanics

Statuses and rules that more than one ánima can apply or exploit. Add here before using one in a
second ánima.

### Sangrado (bleeding)

- A **stacking** status on a foe (proposal: up to 10 stacks). At the end of each round it deals
  damage **for each stack**: little at first, a lot once it piles up. It loses one stack per round
  if nothing adds more.
- **Payoff skills** read the stacks: the more Sangrado, the harder they hit (*Zarpa en la llaga*).
- Open to other ánimas: anything sharp, cutting or nagging can add stacks; anything else can
  feed off them.
- Built on the combat core's stacking statuses and `custom` effects (`docs/combat.md`); the
  story's fights (`src/battle.ts`) do not have statuses yet.
- Description in skills: one short sentence, e.g. `Añade sangrado.`

### Mareo (dizziness)

- A stacking status that lowers Velocidad. First used by El Vértigo (`docs/quests/nuria.md`).

| Mechanic | Applied by | Exploited by |
| --- | --- | --- |
| Sangrado | Papagato (Haru) | Papagato (*Zarpa en la llaga*) |
| Mareo | El Vértigo (foe) | — |

## How an ánima is built

Generic steps every ánima follows; each folder's *Implementation* section says which are done.

1. **Identity**: `ClassId` and `ANIMA_NAMES` (`src/battle.ts`); `CLASSES` (`src/classes.ts`):
   name, motto, colour, `look` (material recolours by name) and an optional accessory (like
   Noísta's `scarf`).
2. **Stats and skills**: `CLASS_STATS` and `SKILLS` with `class: '<id>'` (`src/battle.ts`);
   descriptions in the `AGENTS.md` shape, checked by `tests/battle.test.mjs`.
3. **Interface theme**: `#hud[data-class="<id>"]` in `src/style.css`.
4. **Unlock**: a story flag and the moment it happens (`src/story.ts`, the chapter file), with
   the *ÁNIMA DESBLOQUEADA* banner.
5. **Levels and combined skills**: once those systems exist (see above).
6. **Shared mechanics** it needs (statuses in story fights do not exist yet).
7. **Screenshots**: a scenario in `scripts/screenshots/` showing the look, the interface and the
   skills; `docs/party.md` updated.
