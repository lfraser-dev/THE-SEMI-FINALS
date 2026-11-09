# THE SEMI-FINALS

A browser FPS in the spirit of The Finals, with a white grid sandbox look.

**Build 0.5: Test Range + Parkour Course, with attachments and abilities.** There are no enemies yet. This build is a sandbox for testing movement, gunplay and destruction.

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

Reload animations differ by gun. The old mag drops onto the floor, a fresh one comes up in your hand, and an empty mag means a longer reload with a charging-handle pull. Casings eject on every shot.

Aim, shoot, dash, grapple and slam keys can all be changed in the menu under Settings, and aim can be set to hold or toggle. This helps on trackpads.

## Abilities

| Ability | Key | Cooldown | Notes |
| --- | --- | --- | --- |
| Dash | Q | 2 charges, 2.2 s each | A burst in the direction you're holding. You keep the speed afterwards, and a mid-air dash catches your fall. |
| Grapple | G | 4.5 s | A hook up to 45 m away reels you in. The crosshair turns into a ring when a target is in range. Jump to let go with a boost. |
| Ground slam | Z | 7 s | Dives into the ground. The shockwave damages dummies and breaks destructible wall chunks, and it hits harder the further you fall. |

## Workbench and attachments

The workbench sits in the south-west corner by the weapon wall. Press E there to open it, pick a gun, and click attachments on or off. The stat bars show the change, with a marker for the factory value, and hovering an option previews it. Loadouts are saved per gun.

| Slot | Options |
| --- | --- |
| Optic | Mini red dot, holo sight, 2× prism, 4× scope (with overlay) |
| Muzzle | Suppressor (quiet, no flash), compensator, muzzle brake, full choke (shotgun) |
| Barrel | Long barrel (more range), CQB barrel (better handling) |
| Underbarrel | Vertical grip, angled grip, laser sight (visible beam, tighter hip fire) |
| Magazine | Extended mag, fast mag, drum mag (AR / SMG) |
| Stock | Light, heavy, or no stock |

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
src/weapon.js         gun logic, reload animations, first-person viewmodel + hands
src/attachments.js    attachment list, per-gun mounts, buildDef() that applies stats + model parts
src/bench.js          workbench menu UI
src/weapons.js        weapon stats + box models (add new guns here)
src/effects.js        debris, tracers, decals
src/props.js          dummies, destructible walls, weapon cases, 7-seg signs
src/audio.js          procedural sound effects
src/maps/testRange.js the map (data + build function), incl. the parkour annex
```

To add a map, copy `src/maps/testRange.js` and change the boxes. Each map defines `spawn`, `build(world)`, `dummies` and `walls`.

## Roadmap

- [ ] Online multiplayer
- [ ] Real maps
- [ ] More weapons and classes (light / medium / heavy)
- [ ] Enemies / players
