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
- They never talk and never stay to fight: they send what they possess instead.
- Built procedurally in `src/minion.ts`.

## People

| Who | Role |
| --- | --- |
| **Gerard** | The protagonist. Chapter 1 opens on his birthday as a kid. Power: changing class by changing mood. |
| **Bernat** | Gerard's best friend and neighbour on Passatge Maresme. Designs games in a notebook, including La Reina Bubbaloo. Joins as a companion. |
| **Jan** | Gerard's older brother. Teases him; brews a "POCIÓ" on his desk. |
| **Mamá** | Gives Gerard running shoes for his birthday and sends him to fetch Bernat. |
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

## Running threads

- **M1**: the conjuro chosen at the end of chapter 1 pays off later (see `docs/chapter-1.md`).
- **The mood power** (Alegre, Enfadado, Tranquilo) is planned for chapter 1's later blocks.
- **The pink light**: a story flag (`first-fight`) keeps Sant Quirze in La Reina Bubbaloo's tint.
