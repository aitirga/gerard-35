# The lights at home

Gerard plays at home, in the Meridiana flat, and the flat has LIFX bulbs. Once connected, they play
along: every place lends the living room its colours, fights flash and turn red as health runs
out, and the Meridiana flat in the game *is* the real one, both ways.

At home the game talks to the bulbs **on the LAN** (`lifx_lan.py`, LIFX's UDP protocol): a change
reaches a bulb in about 10 ms and there is no rate limit. Away from home (or for a bulb the LAN does
not find) it goes through the LIFX Cloud with the house's own library,
[geraitor_domotic_house](https://github.com/aitirga/geraitor_domotic_house), a git submodule in
`vendor/geraitor_domotic_house` (`just setup` checks it out, `just lights-update` moves it to its
latest `main`); the cloud takes up to a second.

## Turning it on

1. At home nothing else is needed: `just backend` finds the bulbs on the network. For the cloud
   fallback put `LIFX_TOKEN` in `.env` (https://cloud.lifx.com/settings).
2. `just backend` and `just dev`, open the game, press Esc and pick **07 · Luces de casa**.
3. **Conectar las luces de casa.** The choice is remembered in this browser. The page says whether
   they go *por la red de casa, al instante* or *por la nube*.

**Soltar las luces** gives the house back the lights of the flat (see below), and closing the tab
does the same. Nothing changes at home until the lights are connected.

| Option | What it does |
| --- | --- |
| Habitaciones | *Solo el salón* (default): places and fights use the four living-room bulbs. *Toda la casa*: the bedroom, terrace, study and gallery get a dimmer echo too. The flat always mirrors every bulb |
| Intensidad | *Suave* dims everything and swaps No-ta's strobe for a swell; *Normal*; *Intensa* |
| Adelanto | How long before a hit the bulbs are told. **Auto** (default) uses 40 ms on the LAN and 500 ms through the cloud; − and + set it by hand (0–1500 ms). **Probar** tells the bulbs now and flashes the screen after the lead: adjust until both flash together |

## The bulbs

| LIFX name | Room at home | In the game |
| --- | --- | --- |
| Cocina | Living room, beside the fridge and pantry block | Pendant beside the fridge and oven column |
| Sofá | Living room, over the sofa | Pendant over the sofa |
| Luna | Living room, little table by the computer desk | Moon lamp on a round table at the end of the desk |
| Mesa | Living room, the round dining table | The arc lamp, reaching over the round table |
| Cama + Armario | Bedroom, both over the bed | Two pendants over the bed, **one light**: switched together, either one on means on |
| Terraza | Balcony | The wall lantern |
| Estudio | Study | Pendant in the study |
| Galeria | Gallery | Pendant in the gallery |

Bulbs are found by these names (`HOUSE_LIGHTS` in `src/home-lights.ts`, where a light may have
several); a bulb that does not answer is left out until it comes back.

## The Meridiana flat mirrors the house

- Every lamp above is a switch in the game. **E opens its dial** (`src/lamp-picker.ts`), turning
  it on if it was off: a colour wheel (whites in the middle, colours towards the edge), a brightness
  bar, quick picks from candle to daylight and twelve colours, and the power button. Keys: ← → step
  through the quick picks, ↑ ↓ brightness, Space on/off, E or Esc closes; the mouse drags the wheel
  and the bar; a controller uses the D-pad, A and B.
- **Game → house.** Every change shows on the lamp in the game and goes to the bulb as it happens
  (at most every 45 ms while dragging, with a 0.15 s fade).
- **House → game.** While Gerard is in the flat the game reads the bulbs every 250 ms on the LAN
  (3 s through the cloud): a lamp switched at home (the LIFX app, a switch, Siri) shows in the game
  within half a second. For a moment after the game changes a bulb (1.2 s on the LAN, 4.5 s through
  the cloud) its readings are ignored, so a bulb still fading is not taken for a person.
- **The lamps light the flat.** The window light is kept low there, so a lamp turned off leaves its
  room in shadow and a coloured one tints the walls and the floor.
- When the lights connect, the flat starts as the house is right now. Leaving the flat hands the
  bulbs to the place outside; coming back gives them the flat again. Letting go (or closing the
  tab) puts every bulb back as the flat has it.
- Without the lights connected the lamps still work, in the game only.

## Places

Each place sets the living room's four bulbs from its main colours (`PLACE_LOOKS`):

| Place | Kitchen · sofa · moon · table |
| --- | --- |
| Sant Quirze street | Low sun · blue sky · garden green · amber |
| Gerard's childhood home | Warm whites and amber lamps |
| Avinguda Meridiana | Peach façades · sky · green awnings · white |
| Rec Comtal | Brick · pale sky · white · terracotta |
| La Reina Bubbaloo's palace | Rose · lilac · candle · magenta, and the table lamp beats slowly like the Corazón Líquido. Pink, but kept at half saturation and half brightness: a room, not a flood |

La Reina Bubbaloo's light (the game's `tone`) tints any place towards her pinks, at most halfway;
chapter 2's evening dims and warms it. Colour changes go in steps of a tenth, so a slow fade costs
a handful of requests.

## Fights

- **Entering a fight** the room switches to the encounter's palette (street dogs amber, possessed
  dogs pink, the palace minion and guards magenta and violet) with a white flash.
- **Hits are timed to the contact.** Party hits flash white (Impulso orange, a knockout gold),
  hits on the party flash red, Defender blue, healing green, the gum shell swallowing a hit pink,
  and No-ta strobes violet. Flashes play on the kitchen, sofa and moon bulbs.
- **Low health raises the tension.** As the weakest fighter still standing loses health the
  palette slides to red and the room darkens; below about 38 % the table lamp starts a heartbeat,
  faster below 15 %. Palette changes leave that lamp alone so they never cut the heartbeat.
- **Winning** turns the four bulbs gold, green, cyan and pink for a moment; **falling** sinks them
  to a dark red until *Despertar*, then pink and black as Gerard wakes up at home.
- **Watching the TV news** the sofa bulb flickers blue like the screen.

### The lead

The game tells the bulbs `lead` ms before a hit lands. A hit lands 0.46 s into its animation
(`CONTACT_SECONDS`); on the LAN the flash is simply sent 40 ms before that. Through the cloud a
request takes 0.2–1 s, so with a lead longer than the wind-up the game holds the action back by
the difference (40 ms at 500 ms) and the lights never arrive late.

## Requests

On the LAN every state goes straight out as SetColor/SetLightPower and flashes as SetWaveform, each
acknowledged by the bulb and sent again once if it is not. Through the cloud LIFX allows 120
requests a minute and `lights.py` stays under 100 with a token bucket:

- States queue per bulb and only the newest is sent; one look for several bulbs goes as one fast
  request.
- Flashes skip the queue (they are timed) and only the last three wait.
- Reading every bulb is shared for 1.5 s, and only happens while Gerard is in the flat.

A fight spends about one request per action.

## On a server reachable from the internet

`/api/lights` drives real bulbs, so on Fly (`FLY_APP_NAME` is set) it answers only to a browser
carrying the house key: `HOME_LIGHTS_KEY`. `just deploy-lights` stores `LIFX_TOKEN` and
`HOME_LIGHTS_KEY` from `.env` as Fly secrets; open the deployed game once with
`?luces=<HOME_LIGHTS_KEY>` and that browser keeps it. Locally no key is needed.

## Code

| File | What |
| --- | --- |
| `lights.py` | The bridge: `/api/lights` (read), `PUT /api/lights` (states), `POST /api/lights/effect` (breathe or pulse); LAN first, cloud for the rest |
| `lifx_lan.py` | LIFX's LAN protocol: discovery, reading, colour, power and waveforms |
| `src/lamp-picker.ts` | The lamp dial |
| `src/home-lights.ts` | The bulbs, places, fights, flashes (pure) and the director: settings, mirroring, timing |
| `src/home-lights-ui.ts` | The menu page |
| `src/home-scenery.ts` | The flat's lamps: light, bulb and the patch of light on the floor (`scenery.ts` keeps the flat's window light low) |
| `tests/test_lights.py`, `tests/home-lights.test.mjs` | Offline tests; nothing touches the bulbs |

`just screenshots home-lights` shows the lamps and the menu page without connecting the bulbs.
