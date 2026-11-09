# THE SEMI-FINALS

A browser FPS in the spirit of The Finals, with a white grid sandbox look.

**Build 0.3: Test Range.** There are no enemies yet. This build is a sandbox for testing movement, gunplay and destruction.

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
| Left mouse | Shoot |
| Right mouse | Aim down sights (the sniper scopes in) |
| R | Reload |
| E | Take a gun from a case |
| 1 / 2 / Q / scroll | Switch weapon |
| T | Reset the range |
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

## Movement feel

- Vaults and mantles are animated: your free hand plants on the ledge or wall top, the gun tucks out of the way, and the camera rolls and dips with the move. You can't shoot mid-vault or mid-mantle.
- A vault keeps your speed. Jumping into a low wall mid-air vaults it instead of climbing on top.
- Landings, mantles and vaults use spring-based camera motion that dips and settles instead of snapping.
- The gun has inertia: it trails your movement and mouse look, swings harder when sprinting and dips on landing.

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
src/player.js         movement, vault/mantle, collision, camera springs
src/weapon.js         gun logic, reload animations, first-person viewmodel + hands
src/weapons.js        weapon stats + box models (add new guns here)
src/effects.js        debris, tracers, decals
src/props.js          dummies, destructible walls, weapon cases, 7-seg signs
src/audio.js          procedural sound effects
src/maps/testRange.js the map (data + build function)
```

To add a map, copy `src/maps/testRange.js` and change the boxes. Each map defines `spawn`, `build(world)`, `dummies` and `walls`.

## Roadmap

- [ ] Online multiplayer
- [ ] Real maps
- [ ] More weapons and classes (light / medium / heavy)
- [ ] Enemies / players
