# Action points per ánima (proposal)

Status: idea, not decided, nothing built · Last updated: 2026-10-25

Replace Secundaria (one shared mana bar per fighter) with a **small pool of action points for
each ánima**. Every fight starts with all pools full, but they are short, so a fighter who wants
to keep using skills has to **change ánima**. While one ánima is worn, the others rest and get
points back. The goal is that changing ánima is the heart of a fight, not a menu you open once,
and that every new ánima found by exploring makes fights richer, not just bigger.

Working name: *puntos de acción* (PA). A diegetic name is open (see the end).

## Why

- Today Secundaria is one bar per fighter for every skill. Changing ánima is free and keeps the
  bar, so the best play is to find the strongest ánima and stay in it.
- The game wants exploration and change: ánimas come from friends you helped, and Gerard's power
  is precisely changing. Fights should reward having many ánimas and using them all.
- Small numbers (3, 4 points) are readable at a glance and make each skill a decision, which
  fits a game for two players talking to each other.

## Rules (proposal)

1. **One pool per ánima and per wearer.** Gerard's Noísta and Aitor's Noísta are separate
   pools, so two players never spend each other's points. Bernat wears none and has none.
2. **Full at the start of every fight.** Nothing carries over between fights: no rationing
   across a dungeon, no potions to buy for it, and no reason to avoid fights.
3. **Small.** Proposal: 3 points per ánima at level 1. Skills cost 1 (light) or 2 (strong);
   a rare one costs 3 (the whole pool).
4. **Atacar and Defender are always free.** A fighter is never stuck; an empty ánima only
   loses its skills.
5. **Resting ánimas recover.** At the end of each round, every ánima a fighter owns but did not
   wear during that round gets **+1** point (up to its maximum). The worn one does not.
   - Wearing an ánima at any moment of the round counts as wearing it, so swapping back and
     forth within one turn recovers nothing.
6. **Changing stays free** and keeps the turn (as now). The cost of changing is the round the
   new ánima is not resting.
7. **Defender** also gives the worn ánima +1 point: a slow way to stay in one ánima if you
   really want to.

With two ánimas the rhythm is: spend Noísta's 3 points over two turns, switch to Matemágico
(full), spend it while Noísta recovers, switch back. With four, there is always a rested one.

### Ideas to try on top

Not part of the base proposal; test once the base works.

- **Fresh entry:** the first skill used after switching into a *full* ánima gets a small bonus
  (or costs one point less). It rewards rotating instead of draining one ánima to zero.
- **Echo:** the ánima you just left keeps a weak passive for one round (Noísta's Defensa −1
  lingers, Matemágico's boost lasts one more round). Changing leaves a trace.
- **Combined skills** (`docs/animas/README.md` § Combined skills) spend points from both
  ánimas, one from each wearer: it makes wearing complementary ánimas a plan between players.
- **Lights** from the jar (`docs/home-lights.md`) could raise every pool by 1 for a day instead
  of (or as well as) a stat bonus.

## How it feeds exploration

- **Each ánima found is a new pool.** A friend's mission gives the party more points per fight
  and a new rhythm, so going out to help people is how fights get easier, without a shop or a
  grind.
- **Levels raise the pool or lower costs** (`docs/animas/README.md` § Levels): wearing an ánima
  in fights makes it last longer, which rewards trying every one.
- **Foes can ask for a rotation**: a foe weak to one ánima and resistant to another, or one that
  drains the worn ánima's points, makes the player look for the right ánima at the right time.

## What it looks like

The HUD only shows what the party has (`AGENTS.md`), and every number here is something the
player has.

- **The ánima bar in the dock** (one segment per ánima, up to four) gets small pips under each
  name: how many points each ánima has. It shows at a glance which ánimas are rested, so the
  bar that changes ánima is also the bar that says when to change.
- **The vitals plate** keeps the PV wave; the second wave (SEC) goes, or shows the worn ánima's
  points as pips in the ánima's colour.
- **Skills** show their cost in points ("2 PA"); an ánima at zero greys its skills with the reason
  ("Sin puntos"), like an unaffordable skill today.
- **Recovering:** at the end of a round the rested segments light up as their pips fill, with a
  soft sound, so the rule is learned by watching it happen, not by reading it.
- **Teaching:** the first fight with two ánimas is long enough to empty one; a companion's
  speech bubble says something like "¡Cámbiate, que
  esa ya no da más!" the first time an ánima is empty. No tutorial panel.

## What changes in code

- `Combatant.secondary` / `maxSecondary` become points per ánima, e.g.
  `points: Partial<Record<ClassId, { current: number; max: number }>>`, filled in
  `createBattle` from the party's unlocked ánimas.
- `SKILLS[].cost` moves to points (1–3); `act` spends from the worn ánima; `nextRound` adds +1 to
  every ánima not worn during the round (needs a "worn this round" set per fighter).
- `changeAnima` no longer clamps Secundaria; it marks the new ánima as worn this round.
- `stats.ts`: `sec` leaves the profiles; points per ánima come from the ánima (and its level).
- The combat core (`docs/combat.md`) already models resources as maps, so each ánima's pool can
  be a resource (`ap:<id>`) with no new engine concept; the combat lab can then compare
  "stay in one ánima" against "rotate" strategies.
- `src/vitals.ts`, `src/battle-ui.ts` (pips in the ánima bar, costs in the skill sheet), the
  status screen's Ánimas page (each ánima's maximum).
- `docs/party.md`, `docs/animas/*`, tests in `tests/battle.test.mjs`.

## Open questions

- **Name.** *Puntos de acción* is a placeholder. Something from the world? (*Chispas*,
  *Aliento*, *Ganas*…): each ánima gets tired and comes back.
- **Per wearer or per party?** Per wearer is simpler with two players; a shared pool per ánima
  would force Gerard and Aitor to coordinate who wears what, which may be fun or annoying.
- **Recovery speed.** +1 per round for every resting ánima may be too generous with four ánimas;
  an alternative is that only the ánima you just left recovers, or that the total recovered per
  round is split among the rested ones.
- **Pool size per ánima.** Same for all (3), or part of each ánima's identity (a quick ánima with
  5 cheap points, a heavy one with 2 big ones)?
- **Chapter 1** has only Nen curiós and Noísta for most of it: is a two-ánima rotation enough, or
  does chapter 1 keep Secundaria and the points start in chapter 2?
- **Items** that restore Secundaria (if any are planned) would restore points instead, or go.
