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

`<id>` is the ánima's `ClassId` (`matemagico`, `papagato`; `noista` is a retired design kept
for later). A friend's mission lives in
`docs/quests/<friend>.md` and links to the ánima it gives.

## Two things called ánima

The word covers two related things; keep them apart when designing:

| | What it is | Code |
| --- | --- | --- |
| **A wearable ánima** | A way of being that someone in the party puts on: a look, a colour, an interface theme, stats and skills. Gerard's power is changing it. | `ClassId`, `CLASSES` (`src/classes.ts`), `CLASS_STATS`, `SKILLS` (`src/battle.ts`) |
| **A friend's ánima** | The small light that leaves a friend when Gerard helps them: a party-wide stat bonus that also weakens the palace guards. | `ANIMAS` (`src/animas.ts`), `anima-<friend>` flags |

In fights the word has a third use: **Ánima** is also the points skills spend (§ Ánima points).

Each **person** helped also gives a **light** (a friend's household can give several: Nuria and
Uri give two, one into Gerard and one into Aitor). Lights are kept in a jar at home and can be
spent for a day against the Queen (`docs/chapter-2.md` § The Queen's advance). On screen the lit
ones are counted as the party's **ánimas** (the lore's sense of the word), a currency to spend at
home; they carry no stats and nobody wears them.

A friend's mission usually gives both: the friend's light, and a wearable ánima that comes from
them (Nuria → Papagato). Player-facing text says *ánima* for both, never *clase*.

## Catalogue

| Ánima | Origin | Colour | Stats (wearer) | Skills | Status |
| --- | --- | --- | --- | --- | --- |
| [**Matemágico**](matemagico/README.md) | Chapter 1's palace: Bernat begs Gerard to think | `#f3cf78` gold | Magia +1, Espíritu +1 | Foc Binari; Análisis Parálisis, Ángulo exacto (2); Cardioide (3) | Playable |
| [**Noísta**](noista/README.md) | Was chapter 1's palace: Gerard shouts "¡NO!" | `#e2483d` red | Magia +2, Espíritu +2, Defensa −1 | No-ta | Hidden: retired (2026-11-01), replaced by Matemágico |
| [**Papagato**](papagato/README.md) | Nuria's mission (Cardedeu), `docs/quests/nuria.md` | `#f0954a` orange | Velocidad +2, Fuerza +1, Espíritu −1 | Haru and Yuki | Playable |
| **Físico** | Aitor's own, from chapter 2's first morning | `#8cc6a8` sage | — | — | Placeholder (2026-11-05): name and colour only, to design with `/anima` |
| _Pedro's_ | Pedro's mission (`docs/quests/pedro.md`, to write) | _open_ | _open_ | _open_ | Idea (2026-11-05): a shared ánima from Pedro, a gay friend of Gerard and Aitor they see a lot |

**Who has what** (2026-11-05): Matemágico is Gerard's own and Físico Aitor's (`ANIMA_OWNERS`),
fixed, never taken off. Besides their own, each equips the shared ánimas (Papagato…) in their
extra slots (one for now, `EXTRA_SLOTS`); two never equip the same one. In a fight they switch
among their own and their extras, one at a time (`docs/party.md`).

## Levels

Ánimas **grow**: the more one is worn, the more it learns. Each level brings a new skill or makes
one stronger.

- **Experience (EXP) from fights won** gives levels (decided 2026-11-05, replacing fights won).
- **Story events** can also raise an ánima or teach it something (decided), e.g. the second round
  with its friend.
- How many: proposal, three to four levels per ánima for this game's length.
- Where it shows: the Ánimas page of the status screen (what it has, never what is missing to
  get the next one, per the HUD rule in `AGENTS.md`); a note when a skill is learned.
- Every ánima has its level table in its own folder.

Built (`src/levels.ts`, 2026-11-05):

- **EXP per foe** (`FOE_XP`): a dog 8, a cebollita 10, a platito or fantasmita 14, the palace minion
  30, La Cebolla 35, a gum guard 40, El Plato Misterioso 45, El Cebollón 60, Vertitrón 90 (its
  eye nothing). A won fight is worth all its foes (`fightXp`; La Cebolla y los suyos 35 + 14 + 10);
  a lost or fled one, nothing.
- **Who earns it**: every ánima that **took part** (`participants`): someone acted wearing it
  (`BattleState.fought`, recorded in `act`), or someone still standing wears it at the end. Each
  earns the fight's **whole** EXP, never a share, so changing ánima mid-fight costs nothing.
- **Levels** (`LEVEL_XP`): 180 EXP for level 2, 660 for level 3 (`MAX_LEVEL`), three times the
  first tuning (decided 2026-11-05: ánimas grew too fast). In Uri's tower a pack of cebollitas is
  worth 20 to 30 EXP and El Cebollón 60, so Papagato learns Zarpazos after some seven packs (two or
  three before). Each level reached is a story flag (`papagato-2`, `matemagico-3`…) so it is saved and
  a story event can grant it; the EXP then counts from that level's floor. EXP lives in the browser
  (`gerard35.xp.v1`, like the loadout). A skill with `level` in `SKILLS` is hidden until then, in
  fights and on the Ánimas page (*ÁNIMA · NIVEL n*).
- **The victory screen** (`showRewards`, `src/battle-ui.ts`): *+N EXP* for the fight, then a card
  per ánima that took part, in its colour, with who wore it, its level and its EXP bar filling from
  where it was. A level reached stamps *¡NIVEL 2!* on the card, flashes it with a sweep of light
  (sound `level-up`) and says *Aprende …*. Then what each level taught takes the screen
  (`revealSkill`): one band across it per ánima and level, in its colour and type, *HABILIDAD
  NUEVA* (or *HABILIDADES NUEVAS*), *MATEMÁGICO · NIVEL 2 · GERARD*, each skill's name landing with a
  glint, side by side, with its description and maná, rays turning behind and the result stepping
  back (sound `skill-learned`; 2,1 s, 0,7 s more for each skill past the first). **A level reached
  holds the screen** (`data-holding`): *Seguir* stays dim and no press (Enter, click, a pad's A or B)
  leaves until every bar has filled, every band has shown and 0,9 s more have passed (`LEVEL_HOLD`);
  then it lights up. A fight with no level reached can be left at once, as always.
  The bar shows how far into its level an ánima is; no number says what is missing. A level
  reached in a fight was seen there, so its note does not show again afterwards (`quiet`); one
  granted any other way still shows *ÁNIMA · PAPAGATO · NIVEL 2 · Aprende Zarpazos*.
- Development: the picker's *+25 EXP* and *Subir de nivel*, and *Victoria subiendo de nivel* in a
  fight (`docs/dev-tools.md`). `just screenshots levels` shows the victory screen in a real fight,
  `just screenshots level-up` the hold and the bands from the fight tester.

## Combined skills

**Dual attacks** (built 2026-11-05 for Matemágico + Papagato, `DUALS` in `src/battle.ts`): two
skills of two ánimas, each chosen by whoever wears it, become one action. The fight's side of it
(turns, the queue, the banner) is in `docs/combat.md` § Ataques duales.

- **Only particular pairs**, each one a skill from each ánima, so each one is found, not listed.
- **Gated by what the party has, never by a count of fights**: both halves learned (each skill's
  own `level`), each fighter wearing the ánima of their half, the partner standing and still to act
  this round (later in the order), each half's maná in its wearer's ánima, and a foe to aim at.
- **Once a fight each** (decided 2026-11-05, for now): a dual that has gone off cannot again until
  the next fight (`usedDuals`, `DualBlock` `'used'`); its two skills still work on their own.
- **A surprise** (decided 2026-11-05): nothing glows, no skill is marked as part of a pair, no
  dual is listed or hinted before its skill is picked. With two players, the one who acts later can
  choose ahead in their own dock while the other chooses; when the earlier one picks the skill that
  completes the other half, the dual's banner comes up while they aim it, and confirming fires the
  dual instead (`commit`). Only the earlier fighter completes one. The combined cost and the
  description show only then, in the dual's banner (and in the development Dual command).
- **What it costs**: both turns, and each wearer's half from their own ánima's maná (the skills' own
  costs). Both ánimas take part in the fight (EXP).
- **What it is**: its blow uses the stats of whoever brings the half of its kind (a physical dual,
  the Papagato wearer's Fuerza), and against a foe's kind-based rules it counts as **every kind**:
  the better side of a dish, whole through a see-through foe or a surprise dish. A rule may answer
  duals as such, never a particular ánima. Its
  description follows the AGENTS.md shape, as a skill's (`tests/battle.test.mjs`).
- **Worth** about 1.3–1.5 times the two skills used apart in the same round, plus one edge of its own
  (all eight claws peel, the triple blow), tuned with `just fight-sim`. Not twice: the maná makes
  them punctuate a fight, not replace it.
- **Who can wear what** stays as it is: an ánima is worn by whoever equipped it before the fight
  and never changes person in it (Aitor wears Papagato only if it was put on him).

| Pair | Dual | Halves | Levels | Status |
| --- | --- | --- | --- | --- |
| Matemágico + Papagato | **Zarpazos de fuego** | Foc Binari + Zarpazos | 1 · 2 | Built |
| Matemágico + Papagato | **Punto débil** | Ángulo exacto + Zarpazo de Haru | 2 · 1 | Built |
| Matemágico + Papagato | *Cortina de fuego*, a burning shield | Foc Binari + Yuki se esconde | 1 · 1 | Idea, parked for later |
| Noísta + Papagato | _name open_ | — | — | On hold with Noísta. A "¡NO!" that makes Haru jump: breaks the pringue and cashes in Sangrado |

The pair table lives here; each ánima's folder lists the duals it is part of and links back.

## Ánima points

Skills spend **maná** (once called Ánima points): every ánima has its own, for each wearer, full
with 3 at the start of every fight; Defender gives 2 back to the one worn, and one not worn all
round gets 1 back. See `docs/combat.md` § Maná and `docs/action-points.md`. A dual's halves are each
paid from their own wearer's ánima.

## Shared mechanics

Statuses and rules that more than one ánima can apply or exploit. Add here before using one in a
second ánima.

### Sangrado (bleeding)

- A **stacking** status on a foe (proposal: up to 10 stacks). At the end of each round it deals
  damage **for each stack**: little at first, a lot once it piles up. It loses one stack per round
  if nothing adds more.
- **An open wound** (decided 2026-11-05): the next **physical** blow on someone bleeding (Atacar or
  a physical skill, every claw of a flurry) lands **20% harder for each stack** and spends them all
  (`BLEED_BONUS`, `woundScale` in `src/battle.ts`). Magic leaves the wound alone. A skill that adds
  Sangrado spends the old stacks first, then adds its own. *Zarpa en la llaga* opens it twice as far
  (+40% a stack, `deep`). The fight says so in red over the numbers (*+60% · Sangrado*), the blow
  flares red and tears (`bleed`), and the next actor waits to let it be read.
- Open to other ánimas: anything sharp, cutting or nagging can add stacks; anything else can
  feed off them.
- Built in the story's fights: `STATUSES`, `addStatus` and the end-of-round tick in `nextRound`
  (`src/battle.ts`); 2 PV per stack, up to 10 stacks. The fight shows the stacks as chips under
  each nameplate and the tick as a hit at the round's end.
- Description in skills: one short sentence, e.g. `Añade sangrado.`

### Mental statuses

- Statuses come in kinds: one of the mind, not the body, is **mental** (`mental: true` in
  `STATUSES`, `MENTAL_STATUSES`). Today Mareo and Llorera; Sangrado is not.
- A skill that calms takes away **every** mental status, whichever they are (`cleanse: 'mental'`),
  never a list of names: a new mental status is cleansed by it without touching the skill. Its
  description says so in general (`Quita los efectos de estado mentales.`), and so does the fight
  (*«Se les pasan los efectos de estado mentales.»*).
- First used by Papagato's *Ronroneo de Yuki*.

### Mareo (dizziness, mental)

- A stacking status: per stack Velocidad −2, Defensa −1, Espíritu −1. First used by El Vértigo,
  the boss Vertitrón replaced; no foe brings it now (`docs/quests/nuria.md`). The turn order is fixed when a fight starts, so its Velocidad never
  reorders anyone; its Defensa and Espíritu do the harm.

### Llorera (crying, mental)

- A stacking status: per stack Fuerza −2 and Magia −2 (tears in the eyes). First used by El
  Cebollón (`docs/quests/nuria.md`).

### Punto débil (a mark on a foe)

- Not a stacking status but a mark (`Combatant.weakSpot`), left by the dual *Punto débil*: the next
  action that hurts that foe, from anyone and of any kind, lands three times as hard on every strike
  (`WEAK_SPOT`), then it is spent. Unused, it fades at the end of the next round. Sangrado ticks and
  Quemado pulses neither use it nor spend it. It shows with the foe's stats (a Defensa drop with no
  number, from *Punto débil*).
- Open to other ánimas: anything that sets up a single big blow can leave it.

### Quemado (burning, timed)

- A **timed** status (`docs/combat.md` § Estados en tiempo real): it runs on the fight's clock, not
  rounds. It burns every **2 s** for **10 s**, while the players choose too.
- **Escalates**: fire landing again while it burns raises it a level (I → II → III) and starts its
  10 s over. Each pulse hits ×1, ×3 and ×5 the base pulse, so keeping it going always beats letting
  it go out and lighting it again. At III, fire only starts its clock over.
- The base pulse is 1 PV plus 1 % of the carrier's PV counted up to 100 PV (`pulseDamage`): about
  2 / 5 / 8 a pulse on a dog, 2 / 6 / 10 on a boss, a much smaller share of the boss.
- First used by Matemágico's *Foc Binari*, which always lights it.
- Built: `TIMED.quemado`, `inflict` and `runClock` in `src/battle.ts`; the clock in
  `src/battle-ui.ts`; its look is `quemado` in `src/status-fx.ts` (the flame grows with the level).
  Over the fighter it is an icon with its level and a clock: a ring that empties clockwise behind
  a turning hand, with a notch for each pulse still to come, where the hand will be when it hurts
  (`drain`); the icon flashes as one does. Landing, it says so in orange over the numbers
  (*¡Quemado!*, `pop(…, 'status')`).

| Mechanic | Applied by | Exploited by |
| --- | --- | --- |
| Sangrado | Papagato (Haru) | Papagato (*Zarpa en la llaga*) |
| Mareo (mental) | None now (it was El Vértigo's) | Papagato (*Ronroneo de Yuki* cleanses it) |
| Llorera (mental) | The onions (foe) | Papagato (*Ronroneo de Yuki* cleanses it) |
| Quemado | Matemágico (*Foc Binari*; the dual *Zarpazos de fuego*, on a coin) | — |
| Punto débil | The dual *Punto débil* | Any blow, the next one |

## How an ánima is built

Generic steps every ánima follows; each folder's *Implementation* section says which are done.

1. **Identity**: `ClassId` and `ANIMA_NAMES` (`src/battle.ts`); `CLASSES` (`src/classes.ts`):
   name, motto, colour, `look` (clothes recoloured by what each piece is: `jacket`, `navy`,
   `cream`, `trousers`, the material keys every character shares, `MATERIAL_ROLES` in
   `src/character-model.ts`) and what it adds on the rig in `src/anima-looks.ts` (Papagato's ears,
   tail and collar; Matemágico's ring of digits). It shows in fights; in the street everyone wears
   their own clothes. `scarf` is the colour over the portraits.
2. **Stats and skills**: `CLASS_STATS` and `SKILLS` with `class: '<id>'` (`src/battle.ts`);
   descriptions in the `AGENTS.md` shape, checked by `tests/battle.test.mjs`.
3. **Interface theme**: `#hud[data-class="<id>"]` in `src/style.css`.
4. **Unlock**: a story flag and the moment it happens (`src/story.ts`, the chapter file), with
   the *ÁNIMA DESBLOQUEADA* banner.
5. **Levels and duals**: the skill's `level` (`src/levels.ts`); a dual is an entry in `DUALS` naming
   one skill of each ánima, with its sounds (`dualSounds`, `src/battle-sounds.ts`) and its
   choreography (§ Combined skills).
6. **Shared mechanics** it needs (`STATUSES` in `src/battle.ts`; add new ones to § Shared
   mechanics first).
7. **Screenshots**: a scenario in `scripts/screenshots/` showing the look, the interface and the
   skills; `docs/party.md` updated.
