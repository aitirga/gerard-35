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
2. `just backend` and `just dev`, open the game and choose **Esc → Configuración → Luces de casa**.
3. **Conectar las luces de casa.** The choice is remembered in this browser. The page says whether
   they go *por la red de casa, al instante* or *por la nube*. In development (`just dev`, herdr's
   Start, the `dev-*` recipes) the game never connects them by itself on load, whatever was chosen
   before: they stay off until connected here, for that session.

If the lights are not there the page says why, and they keep trying by themselves: within a few
seconds when the game's server does not answer (not started, restarting, or another app on its
port), every half minute when the server finds no bulbs, and at once when the tab comes back.
Only a missing house key waits for the player. `just backend` listens on 8035 (`GERARD_API_PORT`
moves it, for `just dev`'s proxy too), not 8080, which other projects tend to take.

**Soltar las luces** gives the house back the lights of the flat (see below), and closing the tab
does the same. Nothing changes at home until the lights are connected.

| Option | What it does |
| --- | --- |
| Habitaciones | *Solo el salón* (default): places and fights use the four living-room bulbs. *Toda la casa*: the bedroom, terrace, study and gallery get a dimmer echo too. The flat always mirrors every bulb |
| Intensidad | *Suave* dims everything and swaps Foc Binari's flicker for a swell; *Normal*; *Intensa* |
| Sincronía | The bulbs are told early by what each one takes, measured all the time (§ Timing); the page lists it per bulb. The number is the calibration on top (−400 to +400 ms, − and + by 10). **Calibrar**: tap along with ten flashes of the screen, then ten of the bulbs; the difference is how late the bulbs are seen, and it is corrected. **Probar** flashes the bulbs and the screen together, to check by eye |

## The bulbs

| LIFX name | Room at home | In the game |
| --- | --- | --- |
| Cocina | Living room, beside the fridge and pantry block | Pendant beside the fridge and oven column |
| Sofá | Living room: the oval ceiling light (LIFX Ceiling 13x26") between the sofa and the TV | Oval flush mount, its face glowing in the bulb's colour |
| Luna | Living room: linen cylinder lamp on the white drawer unit at the kitchen end of the desk | The same, on its drawer unit on wheels (the bird of paradise stands at the other end) |
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

## How loud the room may be

The room keeps to **pastels**: colour is capped (`CAPS`: a place .45, a fight .5, a boss .75) so it
tints the living room instead of flooding it. Each place has a register (`registerOf`):

| Register | Places | What the room does |
| --- | --- | --- |
| `claro` | Every street, home and town | Its colours, pastel |
| `penumbra` (dungeons) | Las cuerdas, Emilie's model, Uri's maze, la calle que no acaba, the throne room, the castle's third floor | Everything but the moon at half brightness; the moon keeps the place's accent (up to .7) and **breathes** slowly (7 s) towards dark (`ambience`) |
| `suya` | La Reina Bubbaloo's palace | Her pink may stay pink (up to .7); the Corazón Líquido beats on the table lamp |

**Raw** light (full colour, hard cuts) is kept for the few peaks, so they read as peaks:

| Moment | Light |
| --- | --- |
| A boss turns (Etapa II, Fran's phases) | *Slam*: the room drops almost to black 160 ms before the contact, then full red lands at once; it fades back over 1.8 s |
| A boss loses a part of itself (Vertitrón's eye, Lo Cristalino cracked, a lamp broken), a charged dual let go | Slam in hard white-gold |
| A blow at everyone lands (a card that hits the whole party) | Slam in red. While it is announced (a card aimed at *todos* waiting), the room holds its breath: everything at 55 % |
| The last blow on a boss | Slam in cold white, then the victory colours |
| Someone about to fall | The alarm red and the heartbeat (below) |
| Caught by her minions (`ambush`) | The room goes out with the screen, in a violet-black, until they wake |
| La Sobremesa unmasked (`unmask`) | Slam in violet (the people she holds), then a clean white |
| Her palace rises (`palace`) | Her pink climbs through the room over 4 s, more saturated than anywhere else |
| A turn the castle names over a boss (Aurelià's *La lección*, *La carrera*, *La última recta* and each *Vuelta* of his lap; the Queen's *Las manos* and *La pompa*) | Slam in red, once per turn per fight (`turnOf`: she names *Las manos* twice) |
| La Pompa burst early (*¡Pompa rota!*), one of Direcció's three falling | Slam in hard white-gold |
| She takes Aitor (*Suyo*) | Slam in possession's violet (never her pink) |
| The sixth note frees him | Slam in Aitor's cyan, and her violet leaves the room |

Bosses are the fights in `BOSSES`: the palace minion, El Cebollón, Vertitrón, La Sobremesa, El
Campeón, La Voz, El que no converge, Fran, the three delegadas, Aurelià, el Equipo de dirección and
the Queen. With **Intensidad: Suave** no peak cuts: each one swells instead.

The rest of the story stays soft: walking into a portal sweeps her pink across the four bulbs (kitchen
to table), coming out of one sweeps white back; an ánima waking swells the room into its colour for a
moment; each person's light reaching Gerard or Aitor breathes amber (the jar's glass) on the moon and
the table lamp; waking up starts on a pale morning white.

## Places

Each place sets the living room's four bulbs from its main colours (`PLACE_LOOKS`), through its register:

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

- **Entering a fight** the room switches to the encounter's palette in pastel (street dogs amber,
  possessed dogs pink, the palace minion and guards magenta and violet) with a white flash.
- **Hits are timed to the contact.** Party hits flash a soft white, the fight's answer (a golpe
  crítico, a weakness, a Punto débil spent) a warmer, longer gold, a knockout gold on all four; hits
  on the party flash red, Defender blue, the gum shell swallowing a hit pink, and Foc Binari flickers
  orange (longer when it catches). Flashes play on the kitchen, sofa and moon bulbs. The peaks above
  replace the flash with a slam.
- **Low health raises the tension.** As the weakest fighter still standing loses health the
  palette slides to red and the room darkens; below about 38 % the table lamp starts a heartbeat,
  faster below 15 %. Palette changes leave that lamp alone so they never cut the heartbeat.
- **Winning** turns the four bulbs gold, green, cyan and peach for a moment (pastel; pink is hers); **falling** sinks them
  to a dark red until *Despertar*, then pink and black as Gerard wakes up at home.
- **The answer found** (`answerFound`) is each fight's own as well: a weakness of element or of kind
  of blow, a golpe crítico in any strike, a Punto débil spent, El que no converge converging, ice or
  an Escudo de bits broken, a Cortocircuito that shorts, an electron knocked off El Átomo, the
  castle's *Respuesta correcta*. A **cure** is not a blow: a slow, soft green on the lamps in front.
- **Direcció's three lamps.** In the meeting room one lamp on the table goes out with each of the
  three who falls; at home the kitchen, the sofa and the moon go out the same way.
- **Aitor held.** While the Queen holds him the moon is his light, in possession's violet. The
  artilugio's first note makes her turn: the whole room drops for a breath. Each right note walks
  the moon towards his cyan (a cyan swell on it), a wrong one puts it back (a dark dip); the sixth
  frees him (`note`, called from `src/main.ts` after every note).
- **Watching the TV news** the sofa bulb flickers blue like the screen.

## The end

Her fall is no victory (`isQueen`): after the last blow's cold white the room does not take the
victory colours. It goes still for the last scene (`LAST`): almost dark, a cold dim white by the
windows and her pink, low, on the table lamp, breathing slowly (`LAST_BREATH`) while Gerard
chooses. The end holds the room (`finale`) until the morning after gives it back.

| Choice | The room (`endingCue`) |
| --- | --- |
| **Acabar** | The Foc Binari forms: orange on the lamps in front, flickering (a swell with *Suave*); it goes into her and her pink on the table lamp turns grey and goes out; black, the room with the screen; then, where the throne was, an empty classroom: a cold, low white on the kitchen and the sofa |
| **Bajar la mano** | His hand comes down: the room dims, her pink stays where it is; then the dream ends in white, the four bulbs filling to a soft daylight |

The way to the Monday after (the story's `fall`) goes dark with no pink, whatever was chosen; the
morning comes slower than other mornings, and gives the house back. After *Bajar la mano* some
pink is still in the city: a few seconds later the moon swells faintly pink once and lets it go
(`LEFT_PINK`). Neither ending uses the victory's colours: neither is the right one. The fight
tester's ending preview gives the room back the same way.

## Timing

What a flash has to line up with is the contact **on the screen**. Three things stand between the
game deciding a hit and the room showing it, and each is handled where it is:

| Delay | How big (measured at home, Nov 2026) | Handled by |
| --- | --- | --- |
| The bridge reaching the bulb (Wi-Fi) | 10–80 ms typical per bulb, p90 up to ~200 ms; the bulbs sleep between the router's beacons, so the router holds what goes *to* them | Measured per bulb, all the time; each bulb is sent its message its own latency early |
| The flash rising | A breathe peaks `period × peak` in (45 ms for a hit, half a second for a swell) | `riseOf` / `rise`: a pulse at once, a breathe at its peak or 120 ms in |
| The screen | About a frame and the panel's response: `SCREEN_MS` 15 ms | Added to the moment |
| What no measure sees (the bulb's own start, the eye) | — | The calibration, `late` |

**How it runs.** The game reads the bridge's clock (`/api/lights/clock`, five round trips, the
quickest kept: `clockOffset`) on connecting and every minute. When a hit starts the game knows when
its contact will show, so it sends the flash **at once** with `at`, that moment on the bridge's clock.
The bridge's **timeline thread** (`lights.py`) sends each bulb its message at `at − rise − latency of
that bulb`. Nothing on the game's side times it any more: a long frame, a busy main thread or the HTTP
request in between no longer moves a flash, and the four bulbs land together even when one takes
three times as long as another. Before the clock is read, a timer in the page does it as before.

**The hit waits only when it must** (`holdFor`): when the slowest bulb's latency plus the rise plus
the calibration is more than the hit's wind-up (0.46 s), the game holds the hit back by the
difference. On the LAN it never waits; through the cloud (half a second) about 0.1 s; a slam, whose
dark comes 160 ms before, a little more.

**Measuring.** Writes go out without waiting for the bulb (`LanBulbs.post`): a listener thread hears
the acknowledgements, and every one is a round trip. Each bulb keeps its last 24; its latency
(`one_way`) is the typical trip less half the quickest one (the quickest trip waited for nothing, so
half of it is the answer coming back; the rest of a typical trip is the router holding the message).
While the game drives the lights, a bulb nobody wrote to in 2 s is asked how it is, so its number stays
current; reads in the flat count too. `just lights-latency` prints it all, without changing a bulb.

**Calibrating** (`Calibrar`): ten beats flash on the screen and the player taps along, then ten on
the bulbs. A hand taps a little early or late, and a pad or a key adds its own delay, but the same in
both rounds: the difference of the two medians (`lateness`, first two beats left out) is how much
later the bulbs are seen than planned. It is added to `late`, and every flash goes that much earlier.

**What it cannot fix** is the Wi-Fi's jitter: the same bulb answers in 15 ms or in 150 ms depending on
where the router's beacon falls. Keeping the bulbs awake with frequent messages did not help at home
(measured: no consistent gain, worse when bursting). What helps is the router: a DTIM interval of 1 on
the 2.4 GHz network the bulbs use, and the bulbs close to it. A flash aimed at the median lands within
about ±50 ms, under what the eye notices between a screen and a lamp across the room.

A flash is never sent twice on the LAN (a copy arriving late would start it over); a state that no
bulb acknowledged goes once more.

## Requests

On the LAN every state goes straight out as SetColor/SetLightPower and flashes as SetWaveform,
without waiting (§ Timing). Only a bulb heard from in the last 10 s
is reached on the LAN; one that was found but stays quiet goes through the cloud. macOS's Local
Network privacy may let the server's Python broadcast but not reach a single bulb ("No route to
host"); then each message goes to the network's broadcast address, still addressed to its bulb. Through the cloud LIFX allows 120
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
| `lights.py` | The bridge: `/api/lights` (read, with each bulb's latency), `PUT /api/lights` (states), `POST /api/lights/effect` (breathe or pulse), both with an optional `at`; `/api/lights/clock`; the timeline thread; LAN first, cloud for the rest |
| `lifx_lan.py` | LIFX's LAN protocol: discovery, reading, colour, power and waveforms, sent without waiting; each bulb's latency. `just lights-latency` |
| `src/lamp-picker.ts` | The lamp dial |
| `src/home-lights.ts` | The bulbs, places and their registers, fights, flashes and peaks, the timing (pure) and the director: settings, mirroring, the bridge's clock, cues |
| `src/home-lights-ui.ts` | The menu page and the tap calibration |
| `src/home-scenery.ts` | The flat's lamps: light, bulb and the patch of light on the floor (`scenery.ts` keeps the flat's window light low) |
| `tests/test_lights.py`, `tests/home-lights.test.mjs` | Offline tests; nothing touches the bulbs |

`just screenshots home-lights` shows the lamps and the menu page without connecting the bulbs.
