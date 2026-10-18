# Game memory · lore and key facts

The story bible: who is who, what is true in the world, and what must stay consistent across
chapters. Chapter docs (`docs/chapter-1.md`) say how each part plays; this file says what the
story is about. Update it whenever a decision changes the story.

## The game

- A small browser RPG made for **Gerard's 35th birthday**. It travels through his life, starting
  in childhood in Sant Quirze del Vallès and moving on to Barcelona (Avinguda Meridiana, chapter 2).
- Progress comes from exploring and talking to people; there is no quest log (see `AGENTS.md`).
- Dialogue is in Spanish, with the family's Catalan where it is natural.

## The central villain: La Reina Bubbaloo

- **The whole game revolves around La Reina Bubbaloo**, a villain **Bernat invented** for the game
  he designs in his notebook. In chapter 1 his notebook game becomes real, and she comes with it.
- **Who she really is: Nuria Mendoza.** This is a secret the player does not learn in chapter 1.
  In-game, nobody says her real name until a later chapter decides how to reveal it.
  - Open question: who Nuria Mendoza is in Gerard's life, and when and how the reveal happens.
- **Her look (invented, as Bernat imagined her; nothing to do with Nuria Mendoza's real looks):**
  tall and theatrical; hair piled up in a huge pink beehive shaped like a half-blown gum bubble;
  a crown of five gum balls in different flavours (strawberry, mint, grape, lemon, liquorice);
  a gown made of wrapper paper with twisted ends as puffed sleeves; long sticky gloves; a sceptre
  that is a gum ball with a glowing liquid centre on a stick; a heart-shaped beauty mark and a smug,
  half-closed look. She is nearly always blowing a bubble or about to.
- Her colour is **bubble-gum pink**; her mood is sweet on the surface and sticky underneath.
- Her power reaches the real world through **her minions** and through **colour**: when someone
  beats her minions, she tints the place in her pink, darker and stranger, to show she is watching.

### Her minions (esbirros)

- Small, sticky creatures with a **head made of a Bubbaloo-style gum ball**: glossy pink, lumpy,
  dripping. Their bodies are gooey and leave a pink puddle where they stand. They blow a gum
  bubble from the mouth and pop it.
- They **live in the sewers** and are almost never seen: the only sign is a small pink bubble
  rising through a manhole lid now and then. When they act, a head pokes out for a moment and
  sinks back. Keep them barely on screen; the player should hardly notice them.
- **What they touch obeys the Queen.** Animals they possess get **dark pink eyes** and attack.
- They never talk. Out in the world they never stay to fight: they send what they possess
  instead. Only inside the Queen's palace does one rise from a drain and fight in person.
- Built procedurally in `src/minion.ts`.

### Her palace

- **El Palacio de la Reina Bubbaloo** rises at the north end of Passatge Maresme, growing out of
  the neighbours' houses: gum ramparts, wrapper-twist towers, bubble domes and a crown tower with
  a balcony over the street. It is chapter 1's mini dungeon and the game's final dungeon. It
  leaves Sant Quirze when the boys return to reality, and in **phase two it reappears in
  Barcelona, on top of Gerard's school**. Design: `docs/bubbaloo-palace.md`.

## Gerard's classes

- Gerard's power is changing class. **Noísta** is the first. It comes from who he is: he always
  contradicts, always says the opposite. It is unlocked when he shouts "¡No!" to save Bernat.
  How the class system grows from here is still open. **Classes belong to the party**: Aitor can wear Noísta too (`docs/party.md`). Its skill **No-ta** breaks what the Queen's gum holds. Her minions make things obey;
  Gerard refuses, which is why he is the one who can face her.

## People

| Who | Role |
| --- | --- |
| **Gerard** | The protagonist. Chapter 1 opens on his birthday as a kid. Power: changing class by changing mood. |
| **Bernat** | Gerard's best friend and neighbour on Passatge Maresme. Designs games in a notebook, including La Reina Bubbaloo. Joins as a companion. |
| **Jan** | Gerard's older brother. Teases him; brews a "POCIÓ" on his desk. |
| **Mamá** | Gives Gerard running shoes for his birthday and sends him to fetch Bernat. |
| **Aitor** | Gerard's partner; they live in the Meridiana flat. A man a little taller than Gerard, with a short beard and glasses (provisional model and portrait until there are photos). From chapter 2 he is in the party, played by a second player; he fights with the party's ánimas. |
| **Nuria Mendoza** | The real person behind La Reina Bubbaloo. Secret for now. |

## Places

- **Passatge Maresme, 20 (Sant Quirze del Vallès)**: Gerard's house and street, built from the
  family's plan. Bernat lives on the west side of the same street.
- **Avinguda Meridiana (Barcelona)**: chapter 2's home.

## Story so far (chapter 1)

1. Birthday morning at home: Jan, the potion, Mum's running shoes, the backpack.
2. Gerard fetches Bernat; walking down the street, Bernat stalls: this is the start of the game he
   designed yesterday.
3. Bubbles have been rising from the manhole by the dogs. A gum head pokes out of it, pops a gum
   bubble over the dogs and sinks back; their eyes turn dark pink and they attack: **the first
   fight** (no tutorial).
4. After the win (the minion is still down there, Bernat says) **the whole place's light turns
   gloomy**: darker, pink and strange. It stays that way while they are inside Bernat's game:
   La Reina Bubbaloo is watching.
5. The houses at the north end of the street start to change, and La Reina Bubbaloo's palace
   inflates behind them. Bernat: it is just like his dream, and it is becoming real.
6. Inside, past the hall and the portrait gallery, a minion rises from a drain in the wrapper room.
   Nothing hurts it; when it is about to finish Bernat, Gerard shouts "¡NO!" and becomes a
   **Noísta**. His **No-ta** stamps a giant NO on it and it bursts.

7. Bernat starts to explain (they are in the Queen's castle; she is real; she wants…) and is cut
   off: minions burst out everywhere and **La Reina Bubbaloo's hands** (pink gelatine, so huge
   only her hands and forearms fit on screen) catch them both. Black.

## Chapter 2 so far

- **Gerard wakes up at 35** in the Meridiana flat, shouting "¡NO!", and **Aitor** is beside him.
  Chapter 1 was a dream of his childhood. It is his 35th birthday.
- He **keeps the Noísta class**.
- A **Bubbaloo wrapper** lies on his bedside shelf: something came back from the dream.
- **The day repeats.** From here on Gerard lives his birthday in a loop: every morning starts with
  "¡NO!", dreamlike, beside Aitor; the TV always reports that a castle has appeared on top of the
  **Rec Comptal school**; and the day ends (at its end, or when he falls outside) in black and
  back to 08:00. Classes and what he has learned stay; friends forget. Outside is dangerous and
  gets pinker as the day goes on. Each friend he spends a day with brings out a new class.
  Design: `docs/chapter-2.md`.

## Running threads

- **M1**: the conjuro chosen at the end of chapter 1 pays off later (see `docs/chapter-1.md`).
- **Gerard's classes**: Noísta is the first. How the system grows (and what becomes of the moods
  once planned in `docs/chapter-1.md`) is still open, on purpose.
- **The pink light**: a story flag (`first-fight`) keeps Sant Quirze in La Reina Bubbaloo's tint.
