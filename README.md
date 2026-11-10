# THE SEMI-FINALS

A browser FPS in the spirit of The Finals, with a white grid sandbox look.

**Build 0.19: Fortune Stadium rebuilt at full arena scale, with realistic materials, enterable multi-storey buildings and a 26-storey tower. PLAY drops you in.** The Test Range, Parkour Course and underground bot arena are still there for warming up.

## Run it

It's plain HTML + JavaScript with no build step and no dependencies. Browsers block ES modules from `file://`, so serve the folder with any static server:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| Space | Jump |
| Ctrl / C | Crouch, or slide if you're running |
| Space at a low wall | Vault over it (walls about 0.3–1.35 m high, up to 1.7 m thick) |
| Jump into a ledge | Mantle up (ledges up to about 2 m) |
| Jump into a higher ledge | Grab the edge and hang. Space or keep holding W to pull up, S or Ctrl to drop |
| Sprint-jump alongside a wall | Wall run. Space to wall jump off it |
| Slide → jump → slide on landing | Slide-hop chain: each link adds speed (up to ×5). Holding crouch in the air slides as you land |
| Left mouse / F | Shoot |
| Right mouse / V | Aim down sights (the sniper scopes in) |
| R | Reload |
| E | Take a gun from a case, or use the workbench |
| Q | Dash (2 charges, works in the air) |
| G | Grapple (works in the air; press again or jump to let go) |
| Z | Ground slam (dive and send out a shockwave; leaps first if you're on the ground) |
| 1 / 2 / scroll | Switch weapon |
| T | Reset the range |
| X | Restart the parkour course |
| Esc | Menu / settings |

## Weapons

Six guns sit in glass cases on the wall behind the spawn. You carry two at a time.

| Gun | Type | Notes |
| --- | --- | --- |
| SF-47 | Assault rifle | 30 rounds, 20 damage |
| V9-S | SMG | 1000 rpm, 40 rounds |
| SG-12 | Pump shotgun | 10 pellets, loads shell by shell (fire to interrupt) |
| LH-7 | Bolt sniper | 95 damage, scope, bolt cycles after each shot |
| M60-X | LMG | 100-round box, long reload |
| P-19 | Pistol | Semi-auto; the slide locks back when empty |

Reload animations differ by gun, and they have some flair:
- Mag-fed guns roll in hard, and a wrist flick throws the old mag out spinning. The new mag twirls up from the pouch, then a mag slap jolts the gun and the camera.
- Empty reloads add a charging-handle rip with a counter-roll and a slam-home kick.
- The pistol does a full twirl on empty reloads.
- Every gun has its own draw animation:
  - Pistol: tossed up spinning and caught.
  - SMG: flipped end over end.
  - Rifle: swung in from the right and racked.
  - Shotgun: brought up and racked with a whip.
  - Sniper: shouldered and bolted.
  - LMG: heaved up and dropped into place with a thud.
- During reloads the gun is pulled toward the middle of the screen so the mag swap isn't hidden behind the ammo counter, and mags are coloured (tan or grey) so they stand out.
- The shotgun flips its loading port up, flips each shell in, rocks with every shell, and whips the gun to rack it.

Reload animations differ by gun. The old mag drops onto the floor, a fresh one comes up in your hand, and an empty mag means a longer reload with a charging-handle pull. Casings eject on every shot.

Aim, shoot, dash, grapple and slam keys can all be changed in the menu under Settings, and aim can be set to hold or toggle. This helps on trackpads.

## Look

Characters are built from smooth shapes: tapered capsules for limbs, ellipsoids and rounded boxes. Surfaces have materials (matte fabric, skin, polymer, anodised metal, polished steel, wood, brass and glass), and metal reflects its surroundings.
- **Menu studio (build 0.13):** a seamless backdrop in the class colour with a soft light shaft, a vignette, one key light and a contact shadow. Your contestant stands relaxed, holding the gun low across the body in both hands.
- **Contestants (build 0.14):** smooth, joinless bodies (rounded hips, chest, sloped shoulders, filled knees and elbows, finer meshes), realistic proportions and slim, matte athletic outfits. Light wears a charcoal quarter-zip with a blue cap and white trainers. Medium wears a navy quarter-zip with a gold chest chevron. Heavy wears a yellow plate carrier and a balaclava with goggles. Faces are simple and stylised, and the hands are bare.
- **Guns (build 0.13):** each gun has 30 to 100 parts, including rails with teeth, ejection ports, charging handles, triggers, selectors, pins, slotted handguards, flash-hider slots and mag base plates.
  - The shotgun has a wooden pump and stock, plus a side saddle with shells.
  - The sniper has a fluted barrel, scope turrets and a folded bipod.
  - The LMG has a perforated heat shroud, a carry handle and an ammo box with a feeding belt.
  - The pistol has slide serrations.
  - Attachments hide or move the matching details.
- **Bots:** sleek red robots with dark frames, armour shells, a glowing chest core and a faceless helmet with a glowing visor band.
- **Dummies:** mannequins with a chest target plate and a visor band.

## Cosmetics (builds 0.16–0.17)

Every item is its own 3D model, not just a colour change. Build 0.17 improves the fit: neckwear lies on the outermost layer (so chains and scarves sit on puffers and vests), the puffer shell fully covers the body, the hoodie pocket sits flush, shoulders flow into the arms through a tapered shoulder cap, and the waist blends into the hips. Each card in Customization and the Shop shows a live 3D portrait of the item: worn by your contestant and framed on the right body part, or the skinned gun on its own, against a backdrop in the item's rarity colour.
- **Neck:** the gold chain is a real curb chain of alternating links lying on your clothes, with a medallion and a ruby. The bandana has a rolled band, a front triangle with paisley dots and a knot at the back. The scarf is a chunky knit loop with striped, fringed tails.
- **Head:** the beanie has a ribbed cuff and a pom-pom. The bucket hat has a crown, a band and a wide brim. The Neon Dye Job is spiky hair. The masks are smooth performer face plates with eye slits (the Finalist's eyes glow). The gold helmet is real metal.
- **Tops:** tees have a crew neck, short sleeves and chest prints. The hoodie has a hood, drawstrings and a kangaroo pocket. Class tops are quarter-zips.
- **Outerwear:** the bomber has ribbed trims, a zip and a sleeve pocket. The track jacket has contrast stripes down the sleeves. The puffer is quilted, with puffy sleeves and a high collar. The Champion jacket has red trims and a gold star. The field vest is a plate carrier with pouches and camo. The High Roller is a satin waistcoat with gold buttons.
- **Legs:** cargos with flap pockets, woodland camo, chinos with rolled hems, and trackies with side stripes.
- **Shoes:** combat boots with lugged soles, Clean Kicks trainers, Volt runners with neon soles, and Golden Soles in polished gold.
- **Gloves:** tactical gloves with knuckle guards, boxing tape wraps, and white host gloves with flared cuffs.

## Optics

The 2× prism is a short housing with a wide, open window and a rubber rim, so you can actually aim through it. It has a chevron and stadia reticle. Fitting an optic folds the LMG's front post away.

## Draws and reloads (build 0.15)

Every gun has a show-off entrance, and a highlight sweeps along the gun during the flourishes. Shooting or aiming cuts any flourish short, so it never slows you down.
- **Pistol:** flipped up from the hip with two flips and a roll, caught, then a gunslinger twirl and a press check.
- **SMG:** lobbed in with a double front flip, turned to show it off, then the mag gets a slap.
- **Assault rifle:** tossed in with a full barrel roll, caught, racked, then turned to show its side.
- **Shotgun:** spun over the hand while pumping (a spin-cock), slammed, racked again, then rested muzzle-up for a beat.
- **Sniper:** thrown up spinning, caught, then the bolt is worked and the scope tilts up to catch the light.
- **LMG:** heaved up and dropped with a thud, then the feed cover gets a slap and the gun gives a heavy swagger.

Reloads: the new mag tumbles end over end on its way in, and every reload ends with a barrel-roll finisher. The LMG does a heavy bounce instead, and the pistol does a twirl plus a gunslinger spin. Shotgun reloads end with a spin-cock when empty and a barrel roll when topped up. New spin and catch sounds go with each move.

## Main menu

The game opens on a **Home** screen with your character standing in a lit showroom. The lights take your class colour. On the Home screen:
- the big **PLAY** button takes you to the semi-finals arena, Fortune Stadium (it resumes if you were already there)
- **TEST RANGE** takes you into the range, and resumes your session if you have one
- Enter resumes wherever you were last
- your loadout summary sits in the corner

The top row opens the other screens, and each one has a **Back** button (Esc works too):
- **ARMOURY:** pick your class, its primary weapon and its specialisation (ability).
- **CUSTOMIZATION:** dress each class separately. The slots are head, top, outerwear, legs, shoes, gloves, neck, skin tone and weapon skin. Click an owned item to wear it, or a locked one to preview it on your character.
- **SHOP:** featured items plus a full catalogue you can filter by slot. Click to try anything on, then buy it with credits, which also equips it. You start with 10,000 credits, and earning more will come with the battle pass. Items come in Common, Rare, Epic and Legendary.
- **⚙ (Settings):** controls, sensitivity, FOV, volume and key binds.

Weapon skins (Crimson, Arctic, Desert Ops, Toxic, 24 Karat) recolour your guns everywhere: in your hands, in the weapon cases and in the showroom. Purchases and outfits are saved in your browser.

| Class | Health | Speed | Weapons | Specialisations |
| --- | --- | --- | --- | --- |
| Light | 150 | 112% | V9-S SMG, LH-7 sniper, P-19 pistol | Evasive Dash, Grappling Hook |
| Medium | 250 | 100% | SF-47 rifle, SG-12 shotgun, P-19 pistol | Grappling Hook, Evasive Dash |
| Heavy | 350 | 86% | M60-X LMG, SG-12 shotgun | Ground Slam, Evasive Dash |

Your class sets your health, movement speed and starting guns in the test range. You get your chosen primary plus the pistol as a sidearm, or another class weapon if the pistol is your primary. Only your equipped specialisation works, and it's the only one shown on the HUD.

## Fortune Stadium (build 0.19)

The semi-finals arena, at the scale of a real arena from The Finals: about 280 m × 180 m of play space, with six floating sectors over the void inside a full stadium bowl. Build 0.19 drops the white grid look here (that's only for the test range). Surfaces use realistic procedural materials: glass curtain walls, precast concrete, paving, ribbed metal, office facades with lit windows, asphalt, and crowd-filled seats. Every building can be entered, and every floor is reached by switchback stairs.

You spawn on the team gate behind sector 2, looking in. The tower is on your right.

| Sector | What's there |
| --- | --- |
| 1 | **The court building.** A 4-storey brick ring wrapped round an outdoor basketball court with hoops, bleachers and floodlights. Rooms on every floor, windows onto the court, a billboard on the roof, and a 4-storey block on the corner for the high rooftop (36 m). A launch pad on the court throws you up to it |
| 2 | **The electric building.** An open two-level deck on columns, with stairs up the front and a big double-height opening, leads by a footbridge into the electric building. Inside: a turbine hall with transformers, tanks and switchgear, a mezzanine, a control room with server racks, and a light well. More transformers stand in the yard outside |
| 3 | **The tower.** 26 storeys of glass (117 m to the roof, about 160 m to the tip of the antenna). Every floor has apartments round a concrete core, stairs all the way up, and balconies every few floors on the spawn side and the courtyard side. On top: a helipad, a steel crown with lit ring frames, and a launch pad that throws you down onto sector 4's roof. An outside lift runs from the courtyard to the roof. Beside it is a courtyard with a fountain, trees and a café with a roof terrace |
| 4 | **The giant building.** 5 storeys round an open atrium, with balconies on every floor looking into it and a launch pad in the middle that throws you onto the roof. Offices and rooms in all four wings, glass corner towers, and a huge LED billboard on the roof |
| 5 | **The vault.** A stone bank with a columned portico. Inside is a double-height banking hall and a steel vault with its door open and the cashout station inside; its beam rises through the roof. Offices sit upstairs. It's surrounded by open ground with cover, an armoured truck and a statue |
| 6 | **The maze.** A massive 3-storey block of tight corridors and small rooms: two crossing corridors with a door into every room, and room walls that are a different maze on each floor |

**Getting around.** Steel bridges join 1–2, 2–3, 2–5, 5–4, 5–6 and 1–6, and one runs from the spawn into sector 2. Launch pads aim their arc so you land on the target:
- spawn → sector 1 roof
- spawn → the tower courtyard
- sector 1 court → the high rooftop
- sector 4 atrium → its roof
- tower roof → sector 4 roof

To ride the tower lift, stand by its bottom gate in the courtyard (or by the top gate on the roof) and it comes to you.

**The void.** Fall off a sector and you're out: the screen fades and you're back at the spawn.

**The stadium.** 22 tiers of seats packed with fans on all four sides, LED ribbon boards, glass hospitality boxes, a roof canopy with floodlights round its edge, giant screens at both ends, a centre-hung scoreboard, and Fortune Stadium's floating holographic sneaker bobbing over the middle. Training dummies are spread over every sector and up the tower, and there are destructible walls in sectors 1, 4 and 6 and the tower lobby.

## Underground arena

The combat arena is underground, beneath the range.

**Getting there.** Take the cage elevator by the west wall down through a hatch in the floor. Step into the car and it goes, or stand near either landing and it comes to you. Each landing has a gate that only opens when the car is there. At the bottom, a tunnel leads into the arena.

**The arena.** It is lit by rows of ceiling lamps that throw warm pools of light, with darker fog than the range. It has:
- walls that run up to the ceiling, good for wall running
- a central platform with steps
- a 9 m grapple tower
- cover to vault, mantle and ledge-grab
- a bot bay at the far end, laid out like a firing range, with three spawn pods behind doors

**Starting a fight.** Press **E** at the console by the entrance.
1. Your hand punches the button and the screen goes red.
2. A short cutscene sweeps over the arena and looks down into the pods as the bots drop in on beams of light, and the doors open.
3. A 3-2-1 countdown runs, then FIGHT.

There's no music. The game only plays sound effects.

**The bots.** They're red like the range dummies, with jointed legs and arms and the gun held in both hands. Their animations:
- walk, run and strafe cycles, with legs that swing the way they're moving
- breathing at idle
- head and gun tracking you, with recoil on every shot
- a flinch when hit
- a crouch on landing
- a death fall away from the shot before they shatter

**How they fight.** They pick spots at their preferred range with a view of you, strafe, and fall back to cover when hurt. They fire in bursts. You're much harder to hit when you're moving fast, sliding, in the air, dashing or grappling. There are three types:

| Bot | Notes |
| --- | --- |
| Rifle | Mid range, the backbone of every wave |
| Rusher | Leaner build, fast, gets close, high fire rate. From wave 2 |
| Heavy | Bulkier with shoulder armour, 240 HP, long bursts. From wave 3 |

**Waves.** Waves get bigger and more accurate. The last kill of a wave plays in slow motion, and the next wave drops in after 5 s. Your best wave is saved. Press E at the console again to end the session.

**Survival.** You have 150 HP, which regenerates after 4 s without taking damage. You also get damage-direction arrows, near-miss whizzes, a kill feed, and an eliminated screen that respawns you in the arena after 3 s.

## Abilities

| Ability | Key | Cooldown | Notes |
| --- | --- | --- | --- |
| Dash | Q | 2 charges, 2.2 s each | A burst in the direction you're holding. You keep the speed afterwards, and a mid-air dash catches your fall. |
| Grapple | G | 4.5 s | A hook up to 45 m away reels you in. The crosshair turns into a ring when a target is in range. Jump to let go with a boost. |
| Ground slam | Z | 7 s | Dives into the ground. The shockwave damages dummies and breaks destructible wall chunks, and it hits harder the further you fall. |

## Workbench and attachments

The workbench sits in the middle of the weapon stands, straight ahead from spawn. Press E there to open it, pick a gun, and click attachments on or off. The stat bars show the change, with a marker for the factory value, and hovering an option previews it. Loadouts are saved per gun.

| Slot | Options |
| --- | --- |
| Optic | Mini red dot, holo sight, 2× prism, 4× scope (with overlay) |
| Muzzle | Suppressor (quiet, no flash), compensator, muzzle brake, full choke (shotgun) |
| Barrel | Long barrel (more range), CQB barrel (better handling) |
| Underbarrel | Vertical grip, angled grip, laser sight (beam follows the barrel; tighter hip fire) |
| Magazine | Extended mag, fast mag, drum mag (AR / SMG) |
| Stock | Light, heavy, or no stock |

Shooting while sliding has its own animation. Two-handed guns (rifle, shotgun, sniper, LMG) are canted and tucked, and kick much harder mid-slide. The one-handed guns (pistol and SMG) are held out on one arm while the free hand drags on the floor, and keep their normal recoil.

Not every gun takes every slot. For example, the pistol has no barrel or stock options. Damage now falls off past each gun's range.

## Parkour course

Go through the doorway in the east wall. Run through the red start gate to start the timer.

1. Vault three hurdles.
2. Slide under the beam.
3. Wall run along the divider (or the outer wall) over the red floor.
4. Mantle onto the block, then jump and catch the higher ledge.
5. Cross the stepping stones over the red floor on the way back.
6. Wall run the last wall and go through the white finish gate.

Touching red floor sends you back to your last checkpoint. There are four checkpoints, each showing your split against your best. Your best time is saved in the browser.

## Look

Lighting is done in linear space with ACES tone mapping. It has sun, sky and ground-bounce light, specular highlights (dark metal is glossier than painted concrete), concrete-like surface grain, soft 12-tap shadows, a sky gradient with a sun disc, and a light vignette. Gloves and sleeves are now tactical colours.

## Movement feel

- Vaults and mantles are animated: your free hand plants on the ledge or wall top, the gun tucks out of the way, and the camera rolls and dips with the move. You can't shoot mid-vault or mid-mantle.
- A vault keeps your speed. Jumping into a low wall mid-air vaults it instead of climbing on top.
- Landings, mantles and vaults use spring-based camera motion that dips and settles instead of snapping.
- The gun has inertia: it trails your movement and mouse look, swings harder when sprinting and dips on landing.
- The camera tilts away from the wall on wall runs, your free hand braces against walls on your left, and both the hang and pull-up are animated.
- Footsteps get louder when sprinting and very quiet when crouch-walking. A speed meter sits above the movement state, with the current chain.

## What's in the test range

- Red training dummies with 100 HP. Body shots do 20 damage and headshots do 40. One dummy moves side to side.
- Two destructible walls. Shoot chunks out, and anything no longer connected to the ground collapses.
- A stair platform, a parkour tower, a 2 m mantle wall, step-height test blocks (0.25 / 0.5 / 0.75 / 1.0 m) and a slide tunnel.
- Shooting lanes with 10 m / 20 m / 25 m markers under overhead trusses, plus sun shadows.

## Code layout

```
index.html            HUD, menu, styles
src/main.js           game loop, shooting, HUD updates
src/renderer.js       WebGL2 renderer + grid/edge shader (everything is a box)
src/world.js          box list, collision queries, raycasts
src/player.js         movement, vault/mantle/ledge grab/wall run, collision, camera springs
src/course.js         parkour time trial: gates, checkpoints, hazards, best times
src/classes.js        Light / Medium / Heavy data, ability list, saved loadout
src/cosmetics.js      outfit items, weapon skins, shop catalogue, credits, owned / equipped
src/contestant.js     character rig, outfits and poses (used for the menu showroom)
src/elevator.js       cage elevator from the range down to the underground arena (gates, car, cage)
src/bots.js           combat bots (model, AI, shooting) + wave manager
src/weapon.js         gun logic, reload animations, first-person viewmodel + hands
src/attachments.js    attachment list, per-gun mounts, buildDef() that applies stats + model parts
src/bench.js          workbench menu UI
src/weapons.js        weapon stats + box models (add new guns here)
src/effects.js        debris, tracers, decals
src/props.js          dummies, destructible walls, weapon cases, 7-seg signs
src/audio.js          procedural sound effects
src/maps/testRange.js the test range (data + build function), incl. the parkour annex
src/maps/fortuneStadium.js the semi-finals arena: six floating sectors, the tower, the stadium bowl
```

To add a map, copy `src/maps/fortuneStadium.js` and change the boxes. Each map defines `spawn`, `build(world)`, `dummies` and `walls`. Arenas live far from the range (Fortune Stadium is 700 m away and 63 m up). Only the place you're in is drawn, and boxes outside the view or beyond the fog are skipped. The stadium file has helpers for facades with holes (`panel`, `walls4`), slabs with holes (`slab`), switchback stair cores (`stairCore`) and whole buildings (`building`).

## Roadmap

- [ ] Online multiplayer
- [x] First real map (Fortune Stadium)
- [ ] Bots and objectives (cashout) in Fortune Stadium
- [ ] More weapons and classes (light / medium / heavy)
- [ ] Enemies / players
