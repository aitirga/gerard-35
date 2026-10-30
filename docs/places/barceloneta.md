# La Barceloneta · Platja de Sant Miquel (`barceloneta`)

The beach of the L4: the Passeig Marítim with its palms, wide sand, the Mediterranean breaking on
the shore, L'Estel Ferit's rusty cubes on the sand and the old Barceloneta's narrow blocks behind,
washing on every balcony. It is the brightest, highest-key place in the game: Mediterranean midday
light, sand and blue. The sea is the zone's border.

Status (2026-10-30): **research and draft**. `assets/geo/barceloneta/` holds the zone (`zone.json`),
the OpenStreetMap data (`osm.json`) and the sea (`sketch.json`); `just geo-build barceloneta`
already lays it out (preview in `output/geo/barceloneta/preview.png`). Nothing is wired into the
game yet: the build waits for the shared foundation (real materials, `src/landmarks/`, the sand
area kind, `docs/visual-style.md`), see § Build plan.

## The real place

| What | Facts (checked 2026-10-30) |
| --- | --- |
| Where | Platja de Sant Miquel, the stretch of the Barceloneta's beach between Plaça del Mar and the Barceloneta beach proper; L'Estel Ferit at 41.37649, 2.19109 ([OSM way 161917418](https://www.openstreetmap.org/way/161917418)) |
| L'Estel Ferit | Rebecca Horn, inaugurated July 1992 for the Olympics, also called *Homenatge a la Barceloneta*. Four hollow iron cubes, stacked off true; [BCNROC record](https://bcnroc.ajuntament.barcelona.cat/jspui/handle/11703/80765): 10.60 × 5.17 × 5.17 m, iron, glass and light on a reinforced concrete base. A homage to the old neighbourhood and the beach bars (*xiringuitos*) that stood on the sand before the 1992 seafront works ([Barcelona Turisme](https://bid.barcelonaturisme.com/wv3/en/page/1228/l-estel-ferit-the-wounded-shooting-star-rebecca-horn.html)). Locals call it *els cubs* |
| Beach | About 60 m of sand from the promenade wall to the water at the sculpture, widening north-east into the salient behind a T-shaped breakwater (the Platja de la Barceloneta next door: 422 × 89 m, [Viquipèdia](https://ca.wikipedia.org/wiki/Platja_de_la_Barceloneta)). Storms keep taking sand: the city has moved thousands of cubic metres from Sant Miquel to the Barceloneta beach before a season, and the October 2025 *llevantada* left the beaches thinner |
| Promenade | Passeig Marítim de la Barceloneta, Jordi Henrich and Olga Tarrasó with the city's urban projects office, first phase 1992 from Plaça del Mar to Almirall Cervera, FAD prize 1996 ([publicspace.org](https://publicspace.org/works/-/project/b081-passeig-maritim-de-la-barceloneta-2a-fase)). Pedestrian here; large grey stone slabs; a white concrete parapet over a timber boardwalk at sand level; steps down to the sand at the showers; tall fan palms (Washingtonia, by their look); slim masts carrying a stack of round spotlights; black bollards |
| Old Barceloneta | 18th-century grid of *quarts de casa*, raised to four–seven storeys in the 19th and 20th centuries: long blocks one house deep each side, streets five to seven metres wide, ochre, yellow, orange, brick-red and cream render, one small iron balcony per window, washing everywhere, flat roofs (*terrats*) with water tanks |
| Seen from the beach | The W Barcelona, *Hotel Vela* (Ricardo Bofill, 2009, 99 m, 29 floors, [Wikipedia](https://en.wikipedia.org/wiki/W_Barcelona)), a glass sail at the beach's south end; the Torre de Sant Sebastià of the port cable car; Montjuïc |
| Station | L4 Barceloneta is inland at Pla de Palau, about 700 m north-west of the sculpture |

What a local recognises: *els cubs*, the W's sail at the end of the beach, the palms and lamp masts
on the promenade, the lifeguard posts, the showers, the volleyball nets, the guingueta bars, the
vendors calling *cerveza, beer, agua*, and the washing over the narrow streets.

### Photos studied (Wikimedia Commons, openly licensed)

| Photo | What it shows | Author · licence |
| --- | --- | --- |
| [021 Platja de Sant Miquel… l'Estel ferit](https://commons.wikimedia.org/wiki/File:021_Platja_de_Sant_Miquel_(Barcelona),_al_fons_l%27Estel_ferit,_de_Rebecca_Horn.jpg) (2021) | The cubes on their plinth with the rope cordon, a volleyball net beside them, the sea | Enric · CC BY-SA 4.0 |
| [020 L'estel ferit…](https://commons.wikimedia.org/wiki/File:020_L%27estel_ferit,_de_Rebecca_Horn,_platja_de_Sant_Miquel_(Barcelona).jpg) (2021) | Cube proportions, the window bands (two rows of six small panes near each cube's top), the darker bottom cube | Enric · CC BY-SA 4.0 |
| [Promenade and beach, Platja de la Barceloneta, 2015](https://commons.wikimedia.org/wiki/File:Promenade_and_beach,_Platja_de_la_Barceloneta,_Barcelona,_2015.jpg) | The parapet, slabs, palms, lamp masts, a shower on its deck, the W at the end | DimiTalen · CC0 |
| [Aerial view of the Promenade and Somorrostro Beach (2021)](https://commons.wikimedia.org/wiki/File:Aerial_view_of_the_Promenade_and_Somorrostro_Beach_in_Barcelona_(51225533277).jpg) | The coast from above: sand, turquoise to deep blue, breakwaters, the W, the blocks, Montjuïc | dronepicr · CC BY 2.0 |
| [Passeig Marítim de la Barceloneta](https://commons.wikimedia.org/wiki/File:Passeig_Mar%C3%ADtim_de_la_Barceloneta,_Barcelona.jpg) | Boardwalk, slabs, bollards, a weathered-steel monolith, a beach bar | Nicolas Vigier · CC0 |
| [Barcelona – Passeig Marítim de la Barceloneta 2026](https://commons.wikimedia.org/wiki/File:Barcelona_-_Passeig_Mar%C3%ADtim_de_la_Barceloneta_2026.jpg) | Granite setts, red Bicing bikes, blue-and-white parasols | Jorge Franganillo · CC BY 4.0 |
| [Autobús D20 al Passeig Marítim, 20 Oct 2026](https://commons.wikimedia.org/wiki/File:Autob%C3%BAs_D20_al_Passeig_Mar%C3%ADtim_de_la_Barceloneta_-_20261020_165351.jpg) | The promenade's palm rows and grooved paving ten days ago | Pere López Brosa · CC BY-SA 4.0 |
| [Lifeguard tower, Platja del Bogatell (Oct 2023)](https://commons.wikimedia.org/wiki/File:Lifeguard_tower,_Barcelona_Beach,_Platja_del_Bogatell_(October_2023).JPG) | Today's post: white cabin on a steel frame, orange *SALVAMENT* band, number | Benoît Prieur · CC0 |
| [Platja de Sant Sebastià 04](https://commons.wikimedia.org/wiki/File:Platja_de_Sant_Sebasti%C3%A0_(Barcelona)_04.jpg), [Baywatch](https://commons.wikimedia.org/wiki/File:Baywatch_(7550081326).jpg) | The older 1992 lookout: a leaning timber-and-steel mast, round platform, shade ring | Enfo · CC BY-SA 3.0; Martin Abegglen · CC BY-SA 2.0 |
| [W Hotel seen from Platja de Sant Miquel](https://commons.wikimedia.org/wiki/File:W_Hotel_seen_from_Platja_de_Sant_Miquel.JPG) | Waves in two or three white lines, the wash on the sand, the W | Jordiferrer · CC BY-SA 3.0 |
| [Barrio de la Barceloneta 02](https://commons.wikimedia.org/wiki/File:Barcelona_-_Barrio_de_la_La_Barceloneta_02.jpg), [04](https://commons.wikimedia.org/wiki/File:Barcelona_-_Barrio_de_la_La_Barceloneta_04.jpg) | Narrow streets, render colours, balconies, washing, blinds, flags | Zarateman · CC0 |
| [Carrer a la Barceloneta](https://commons.wikimedia.org/wiki/File:Carrer_a_la_Barceloneta.JPG) | Orange render, stone surrounds with arched heads, iron balconies | Jordiferrer · CC BY-SA 3.0 |
| [Casa de la Barceloneta 1761](https://commons.wikimedia.org/wiki/File:014_Casa_de_la_Barceloneta_1761,_c._Sant_Carles_6_-_c._Sant_Miquel_52_(Barcelona).jpg) | The one original two-storey house left (Sant Carles 6), outside the zone | Enric · CC BY-SA 4.0 |

Raw downloads stay in `output/refs/barceloneta/` (git-ignored, with `credits.jsonl`). Google Maps
and Street View were only looked at (`output/geo/barceloneta/google/links.md`).

## Identity

Status: refined from `docs/visual-style.md` because the photos put the sand a touch lighter and
warmer (`#e6d0a2`, ΔE 1 from the proposal), name the wet band and the promenade, and choose the
sea's sun glitter as the place's one glow.

| | |
| --- | --- |
| Dominant | Sun-bleached sand `#e6d0a2` |
| Secondary | Shore turquoise `#4fa3a5` deepening to `#2a6f8e`, wet sand `#b39a72`, promenade stone `#a9adb0`, Barceloneta ochre `#d9b26f` |
| Material | Sand (`sorra`, tinted light) with its wet band (`sorra-humida`, new); the sculpture's rusted iron (`acer-corten`, new) |
| Ground | Trampled dry sand, the dark wet band at the waterline, the promenade's grey slabs and timber boardwalk, the old streets' asphalt |
| Landmark | L'Estel Ferit, four rusty cubes stacked off true to 10.6 m on the sand (kind: a stacked sculpture); the W's glass sail at the end of the beach as backdrop |
| Light | `barceloneta`, new: the highest key in the game, cool, open blue shade, low contrast; `day` sky, high and pale; midday. Its one glow: the sun glittering on the sea |
| Props | Washingtonia palms, lamp masts with stacked spotlights, black bollards, showers on timber decks, the *SALVAMENT* cabin and the old leaning lookout, volleyball nets, a guingueta with loungers and parasols, towels, the rope cordon round the cubes, Bicing bikes, yellow buoys offshore |
| Air | A sea breeze (palms and flags move), sand blown low in gusts, spray where the waves break, a few gulls |
| Sound | Waves breaking and the hiss of the backwash, gulls, a vendor calling *cerveza, beer, agua*, a volleyball, bike bells on the promenade |
| Only here | The sea: waves run up the sand and pull back, leaving a dark wet band and a lace of foam that fades |
| Text | Catalan: *PASSEIG MARÍTIM DE LA BARCELONETA* on the ground, the *Platja de Sant Miquel* boards, *SALVAMENT*, the flag board; the block ends' real restaurant names (Can Majó, Surf House, Casa Costa…) in plain type |
| Wink | A sand sculpture of a sleeping cat by the promenade, its sculptor's cap beside it for coins (the flat's cats) |

**Against the others.** Nearest dominant: Casa de Gerard (`#ecdcb8`, ΔE 7): an amber room of
plaster and tile against open sand, sea and cool midday light. Plaça d'Espanya ΔE 11 (warm
golden stone and water), Maresme ΔE 16 (white render, warm), Búnkers ΔE 22. No other place has
sand, a sea or a stacked sculpture. No neighbours by the contrast rule: no place within three L4
stops, none in Ciutat Vella, and the Búnkers only see the sea as part of the miniature city.

**Gerard first.** The sand is light (L* 84) and low in saturation; Gerard's navy (L* 17) reads
hard against it, his mustard by saturation. The greyscale check matters here more than anywhere:
keep the sand pale rather than yellow. Reserved colours: the lifeguard band stays orange
(`#ef7d32`, not Noísta's crimson), the volleyball nets white with a dark band (the L4 yellow is
the totem's), parasols blue and white, nothing pink.

Proposed look, in `LOOKS`' shape:

```ts
/** La Barceloneta: the brightest place, a high Mediterranean midday; cool, with open blue shade. */
barceloneta: {
  grade: { temperature: -.05, lift: [.01, .012, .016], shadows: [-.004, .004, .016], highlights: [.012, .01, .004], contrast: .98, saturation: 1.02 },
  enhance: { vibrance: .08, shadows: .12, highlights: -.06, dehaze: .03 },
},
```

## Layout

`assets/geo/barceloneta/zone.json`: anchor L'Estel Ferit, turned 65° (`bounds_turned`) so the coast
runs along x and the sea faces the camera; 280 × 220 m (x −150…+130 along the coast, z −100…+120
from the old Barceloneta to the sea), 1.5 m cells (187 × 147). From the camera inwards:

| Band (turned z) | What |
| --- | --- |
| Sea, z > +43…+109 | Water from `sketch.json` along OSM's coastline; a far sea plane continues past the map's near edges. Yellow buoys, a paddle surfer |
| Waterline | The wet band (~4 m) and the swash |
| Sand, z −15…+43 (to +109 in the salient) | Platja de Sant Miquel (OSM `natural=beach`): the cubes at 0,0; the volleyball area beside them (OSM's *Espai per a ús esportiu lliure*, x 10…88); showers at x −117, −10, +98; the Salvaje beach bar at x −91; lifeguard cabin and old lookout (placed, not surveyed) |
| Parapet and boardwalk, z ≈ −15 | A low white wall with gaps at the steps and showers; the timber boardwalk below it |
| Promenade, z −15…−32 | OSM's pedestrian areas: slabs, palms, lamp masts, bollards, benches, Bicing; the ground label |
| Block ends, z −35…−65 | Restaurants on the ground floors (from OSM: Can Majó, Surf House, Casa Costa, Tapaboca, Sea Breeze, KFC…) |
| Old Barceloneta, to z −100 | Long blocks at 45° to the coast; seen from the camera their long fronts face it square on, washing on every balcony. 15 buildings |
| L4 entrance, x 112 z −95 | At the inland edge, at the end of a street: the real station is 700 m inland, *round the corner* |

Borders: the sea (near side), the breakwater's arm coming ashore at the NNE corner (x ≈ 129),
Plaça del Mar's paving at the SSW cut, the blocks inland. Spawn on the promenade beside the
cubes. Backdrop beyond the far edges: the W's sail past the SSW-sea corner (scaled down about
four times and hazed, since the orthographic camera has no perspective), the cable car's tower, and
Montjuïc as a low hill past the inland corner. The camera's follow view spans roughly 36 × 64 m,
so the W reads mostly in the overview (R) and from the west end of the beach.

Places so far: `station-barceloneta` (the stair), `barceloneta-estel` (*Mirar los cubos*),
`barceloneta-mar`, `barceloneta-balcons`. Lines say what Gerard sees, never where to go.

## Texture candidates

The shared library first; four new materials at most, all CC0.

| Use | Candidate | Source · licence | Note |
| --- | --- | --- | --- |
| Dry sand | `sorra` (library: Poly Haven *dense_sand*) tinted `#e6d0a2` | CC0 | First try. If it stays grey: ambientCG [Ground080](https://ambientcg.com/view?id=Ground080) (light, trampled) as `sorra-clara` |
| Wet sand | Poly Haven [damp_beach_sand_02](https://polyhaven.com/a/damp_beach_sand_02) → `sorra-humida` | CC0 | Darker, glossier while the swash covers it |
| Promenade | `granit` (library: *granite_tile*) tinted `#a9adb0`; alternative Poly Haven [granite_tile_04](https://polyhaven.com/a/granite_tile_04) | CC0 | Large grey slabs |
| Boardwalk, showers, bar decks | Poly Haven [old_wood_floor](https://polyhaven.com/a/old_wood_floor) → `fusta-passera` | CC0 | Dark weathered planks |
| L'Estel Ferit | Poly Haven [rust_coarse_01](https://polyhaven.com/a/rust_coarse_01) → `acer-corten` | CC0 | Even deep rust; the bottom cube tinted grey steel |
| Breakwater | Poly Haven [rock_boulder_dry](https://polyhaven.com/a/rock_boulder_dry) → `escullera` | CC0 | Pale granite boulders |
| Facades, roofs, streets | `estuc`, `rajola`, `asfalt`, `panot-gris` (library) | CC0 / own | Under a painted bay atlas |
| Sea, foam | Own procedural (normal map of small waves; foam lace on canvas) | Own | No photo gives a sea seen from above that tiles |

Commons facades (CC0 Zarateman street photos, CC BY-SA Jordiferrer) are references for painting the
atlas, not textures: they are steep perspectives.

## Build plan

After the foundation merges into this branch:

1. **Data.** `just geo-build barceloneta` with the sand class (OSM's beaches become walkable sand,
   and stop the river-bank trees the current build scatters along the shore). Teach `trim()` in
   `tools/geo.py` to leave out `place=sea|ocean` relations (the Mar Balear is 2.5 MB; it was dropped
   from this `osm.json` by hand) so a re-fetch stays small. Trim the bounds if the walk feels long.
2. **Wire it.** `EnvironmentId` and `ENVIRONMENTS` (`geoEnvironment('barceloneta', …)`), the
   `index.html` option, its `PLACES` entry in `src/jump-menu.ts` (group Barcelona, *La playa · L4*),
   `barceloneta: { environment: 'barceloneta' }` in `STATION_PLACES`, the row in `docs/barcelona.md`.
3. **Ground.** Sand tinted, the wet band as a strip along the water's edge (`sorra-humida`), the
   promenade's slabs, the boardwalk, the parapet as a low solid wall with gaps.
4. **Sea.** Its own water (not the river's): turquoise at the shore to deep blue by distance,
   scrolling normals, the sun's glitter as the place's one bloom; a far plane to the horizon. Waves:
   two or three foam crests rolling in and fading, the swash running up the wet band and back on a
   ~7 s cycle, the band darkening and drying behind it. Slower with reduced motion.
5. **Landmarks** (`src/landmarks/`): `estel-ferit` (four 2.6 m cubes, each turned and tilted a few
   degrees off the one below, window bands, the plinth, the rope cordon; opens the see-through cut),
   `salvament` (cabin, band, flag), `guaita` (the old leaning lookout), `guingueta` (white flat
   roof on posts, deck, counter, loungers, parasols), `dutxa`, `voleibol`, `escullera`.
6. **Props.** A Washingtonia `palm` species in `src/props.ts`; a `mast` lamp style; bollards,
   parasols, loungers, towels, buoys; a few gulls.
7. **Facades.** A Barceloneta atlas (narrow bays, one iron balcony per window, washing on lines
   and folding racks, green blinds, flags, air conditioners, stone surrounds) or `flats` with these
   walls; flat roofs with water tanks and aerials; restaurants on the promenade ends.
8. **Light and air.** `LOOKS.barceloneta` (above), its `AIR` (sand drift, spray, ≤ 300 particles),
   the sea breeze.
9. **Backdrop.** The W's sail, the cable car tower, Montjuïc.
10. **Words.** More places (the lifeguard, the bar, the shower, the vendor), the boards' Catalan,
    the wink.
11. **Check.** `scripts/screenshots/barceloneta.json` (the cubes, the waterline, the promenade,
    the L4 entrance, the overview, a greyscale shot), `just screenshots barceloneta --gpu`, `?stats`
    against the Meridiana's budget, `just typecheck`, `npm test`.

## Approximate or open

- Flat ground: the promenade stands about 1.5 m over the sand in reality; here a low parapet marks it.
- The beach's outline is OSM's, and storms move it every winter.
- The lifeguard posts and nets are placed from photos, not surveyed; the station entrance is invented
  (the real one is 700 m inland).
- Storeys default to five where OSM gives none (real: four to seven); a 13-storey block at the SSW
  corner comes from OSM and needs checking.
- The W is a scaled backdrop, not at its real distance.
