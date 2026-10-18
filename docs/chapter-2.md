# Chapter 2 · El día que se repite (Barcelona)

Gerard wakes up at 35 in the Meridiana flat, on his birthday, and the day starts again. And again.
La Reina Bubbaloo's palace has risen on top of the **Rec Comptal school**, and from now on Gerard
lives the same day in a **loop**: he wakes up, the TV gives the same news, and he has until the
end of the day to do what he can. He can't do everything in one day. Each loop he chooses which
friends to find, crosses a Barcelona that has become dangerous, and comes home with a little more:
a new class, something learned, a shortcut. The chapter ends when he is strong enough to climb up
to the palace (see `docs/lore.md` and the [palace design](bubbaloo-palace.md)).

| Block | Status | What |
| --- | --- | --- |
| 0 · Despertar a los 35 | Playable | Gerard wakes shouting "¡NO!", Aitor joins the party (player 2), the Bubbaloo wrapper |
| 1 · El primer día | Plan | The TV news, the clock, first steps outside, the first night and the first reset |
| 2 · El bucle | Plan | The open loop: friends, classes, monsters, fixed events, the city's schedule |
| 3 · El asalto | Plan | The loop in which Gerard climbs to the palace on the Rec Comptal |

**Two players.** From the moment Gerard wakes up, Aitor walks with him and a second player can
play him on a second controller: stats, shared classes and who controls whom are in
[party.md](party.md). Friends in the loop are Gerard and Aitor's friends.

## The loop in one picture

```
08:00  Wake up "¡NO!" · dreamlike haze · Aitor · the wrapper
08:15  TV: "Un castillo aparece sobre la escuela Rec Comptal"
  │
  ├── Morning   the city is still mostly normal; monsters only near the palace
  ├── Afternoon the pink spreads from the Rec Comptal; more streets are dangerous
  ├── Evening   most of the outside is hers; friends are home or gone
  │
00:00  The palace's bubble bursts over the city → black → 08:00 again
       (or: Gerard falls in a fight outside → black → 08:00 again)
```

## The clock

- A small **digital clock** in a corner of the HUD, like a cheap LCD watch or a phone's lock
  screen: `08:15` and the day under it (`JUE · 15 OCT`, the same date every loop). It is
  Gerard's own phone, which fits the HUD rule: it is something he *has*. It says the time, never
  what to do with it.
- The digits take La Reina Bubbaloo's pink as the day goes on, and blink at the last hour.
- **Time moves with what Gerard does, not with real seconds**, so reading dialogue never costs
  time (the game has a lot of dialogue and it should never punish a slow reader):

  | Action | Cost |
  | --- | --- |
  | Walking inside a place (the flat, a street, a friend's house) | Free |
  | Going from one place to another (the city map) | 15–45 min, by distance |
  | A real conversation with a friend (their scene, not a passing line) | 30–60 min |
  | A fight outside | 15 min |
  | Optional activities (piano, a coffee on the balcony, a nap) | 30 min–2 h |
  | Sleeping early | Ends the day |

  The cost is shown only where Gerard is deciding: the city map shows the time of arrival next
  to each destination (`→ 10:40`). Nothing else shows costs.
- **Events happen at set times**, and the player learns the city's schedule by living it, the way
  Majora's Mask does it: a friend is only at the café until 11:00, a shop shuts at 20:00, a
  monster crosses Plaça de les Glòries at 17:30. Nobody lists these; people mention them ("a las
  once me voy, que entro a trabajar"), and a second loop is how the player uses them.

## What resets and what stays

| Stays between loops | Resets every morning |
| --- | --- |
| **Classes** (Noísta and every class earned from a friend): they are part of Gerard | The time, and where everyone is |
| **What Gerard knows**: passwords, routines, secrets, where things are | Common items (potions, food, money spent) |
| **The wrapper** and other things "que vienen del sueño" (key items marked with pink) | Friends' memory of today: they meet Gerard again as if for the first time |
| Levels and stats | Monsters beaten, doors opened, places cleared |

- **Knowledge as a key.** Because friends forget, the second time Gerard can skip ahead by saying
  something only they could know ("Ya sé lo de tu hermana. Me lo contaste… mañana"). This is
  how a friend who took a whole afternoon on loop 1 takes half an hour on loop 4. It is a dialogue
  choice that only appears once Gerard has learned the thing, never a hint.
- **Repeated lines go fast.** Lines Gerard has already heard in an earlier loop are shown dimmed
  and skip with a single key, so the morning routine is quick from the second loop on.

## The morning, every morning

1. Black, then Gerard and Aitor asleep in the same bed, Aitor slowly stroking the back of
   Gerard's hand. "¡NO!" Gerard bolts upright. The first seconds are **dreamlike**: a soft pink blur at
   the edges, a slight echo on sounds, and something from the last loop still on screen for a
   moment (the last place he was, the friend he was with, the Queen's hands). It clears as he gets
   up.
2. **Aitor** sits up beside him with the same first line, and they get out of bed on either side. From the second loop on, Gerard can
   answer differently, and Aitor notices: "Hablas como si ya hubieras vivido esto." Aitor is
   the anchor of the loop: the one person Gerard tells, the one who believes him a little more
   each morning (a running thread: by loop 3–4 he is convinced, and he starts helping, e.g.
   with what he learned at work, or by coming along).
3. The **wrapper** on the nightstand, every morning. It's the proof it is not a dream.
4. **The TV** in the living room: the news, always the same: a castle has appeared on top of the
   Rec Comptal school. The presenter, the shaky mobile footage, the pink on the walls. From
   loop to loop the news changes only when Gerard changed something that will *also* happen today
   (for example, after he has been near the palace, a blurred figure on the footage looks like
   him). It never says where to go; it shows what the world sees.
5. The flat is safe: the door is the way out to the dangerous city.

The first time the clock appears is this morning, when Gerard picks up his phone from the
nightstand: one key hint for it and nothing else.

## Outside is dangerous

- **The palace pours out pink.** The danger spreads from the Rec Comptal as the day goes on:
  in the morning only the streets around the school are tinted; by the afternoon the pink reaches
  Glòries and the Meridiana; by night most of the map is hers. So *when* Gerard goes somewhere
  decides how dangerous it is. The tint uses the same `setTone` as Sant Quirze.
- **Monsters are the city, possessed.** As in Sant Quirze, minions stay in the sewers and possess
  what they touch (dark pink eyes): the Barcelona version of the dogs. Ideas, from tame to strange:
  pigeons (a flock, many weak), seagulls from the port, rats, a stray cat, electric scooters and
  Bicing bikes riding themselves, a street sweeper truck, the Glòries tower's lights, a gegant
  from a festa major (as a mini boss). Each area has its own two or three.
- **Fights cost time**, and running away costs less than fighting but is not always possible.
  Losing a fight outside is not a game over: it ends the day (black, "¡NO!", 08:00). The loop is
  the forgiveness.
- Safe places: the flat, friends' houses once Gerard is welcome there, maybe a bar or a shop
  whose owner keeps the door shut to the pink.

## Friends and classes

The heart of the chapter. Each friend lives somewhere in Barcelona, has their own routine for the
day, and is going through something when the palace appears. Spending time with them, solving
what they need or just being there, wakes up a new **class** in Gerard, born from what that friend
brings out in him (as Noísta comes from always saying no). It extends the idea from chapter 1:
Gerard changes class by changing who he is in the moment.

Template per friend (to fill with the real friends):

| Field | Example (placeholder) |
| --- | --- |
| Who | **Friend A**, an old friend from university |
| Where and when | At home in Gràcia until 13:00; then at work; at night in a bar in Poblenou |
| What's wrong today | The pink has reached their street, their cat is possessed |
| First loop | Gerard arrives as a stranger to the problem: a long scene, a fight |
| Later loops | A line only Gerard can know makes it shorter |
| Class it gives | **Class X**: what it says about Gerard, what it does in a fight |
| What it opens | A skill that solves a problem elsewhere (breaks a gum wall, calms a possessed animal, crosses a flooded street) |

- **Classes open the city.** Each class is also a key in the world: something the others can't
  get past. This is how the order of friends is free but not random: some friends can only be
  reached once Gerard has a class from another one. Gates stay diegetic (a gum wall Noísta can say
  no to, a possessed guard who only listens to someone calm).
- **Friends as companions.** A friend can come along for the rest of the day, like Bernat in
  chapter 1. Only one at a time. They forget at the end of the day, but their class stays.
- **Can't do everything.** A single day has room for about two friends' scenes (or one and
  a lot of exploring). This is where the choice is: whom to visit first, and whom to leave for
  tomorrow.

## The ending (block 3)

- Gerard needs **enough classes** to climb up to the palace (for example, Noísta plus three).
  The palace itself says it: its gate only gives way to what Gerard has become, and what's missing
  shows as a closed lock in the Queen's colours, with a line from a friend or Aitor about it.
- The final loop is a run: from 08:00 Gerard uses everything he knows to gather the right
  friends on the way and reach the Rec Comptal before the palace bursts. That is why everything
  learned in earlier loops matters.
- What happens inside (the Queen, Bernat, Nuria Mendoza) is left for a later decision.

## How it is built (first steps)

- `src/day.ts`: the loop as pure rules, tested like `src/story.ts`. Time in minutes since 08:00;
  `advance(action)`, what happens at each time (`events`), and `reset()` that keeps the persistent
  flags (classes, knowledge, dream items) and clears the rest. Saved next to the story flags.
- Story flags split in two: **loop** flags (cleared every morning) and **forever** flags.
- `src/story-ui.ts`: the clock element in the HUD, and dimmed repeated lines in the dialogue.
- A city map scene that travels between places and spends time.
- `scenery.ts` `setTone` driven by the clock and the distance to the Rec Comptal.
- Screenshot scenarios: `chapter-2-morning` (wake, TV, clock) and `chapter-2-reset`.

## Open questions

1. **Who are the friends?** Gerard and Aitor's friends. Names, where they live in Barcelona, what they're like, and what class
   each one could bring out in Gerard. This decides the whole chapter. Bernat could be one of
   them (now an adult in Barcelona?).
2. **What is the Rec Comptal to Gerard?** Where he works (a teacher?), where he studied, or
   somewhere else? It changes why the palace is there and what the TV says.
3. **Why the loop?** The Queen's doing (she wants something to happen on his birthday), a
   consequence of the dream, or the wrapper's? Keep it a mystery in chapter 2?
4. **How long is a loop?** Ending at midnight is a long day; ending earlier (e.g. at sunset, when
   the palace's bubble bursts) makes each loop shorter and choices tighter.
5. ~~Aitor's role~~: decided. He is in the party from the first morning, played by player 2
   (see [party.md](party.md)).
6. **Real-time option:** the clock moves only with actions (proposed). Ticking slowly in real time
   outside would add pressure but punish reading; not proposed.
