# THE SEMI-FINALS

A browser FPS in the spirit of The Finals, with a white grid sandbox look.

**Build 0.1: Test Range.** There are no enemies yet. This build is a sandbox for testing movement, gunplay and destruction.

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
| Ctrl / C | Crouch (slide if sprinting) |
| Left mouse | Shoot |
| Right mouse | Aim down sights |
| R | Reload |
| T | Reset the range |
| Esc | Menu / settings |

## What's in the test range

- Red training dummies with 100 HP. Body shots do 20 damage and headshots do 40. One dummy moves side to side.
- Two destructible walls. Shoot chunks out, and anything no longer connected to the ground collapses.
- A stair platform, a parkour tower, step-height test blocks (0.25 / 0.5 / 0.75 / 1.0 m) and a crouch tunnel.

## Code layout

```
index.html            HUD, menu, styles
src/main.js           game loop, shooting, HUD updates
src/renderer.js       WebGL2 renderer + grid/edge shader (everything is a box)
src/world.js          box list, collision queries, raycasts
src/player.js         movement + collision
src/weapon.js         gun logic + first-person viewmodel
src/effects.js        debris, tracers, decals
src/props.js          dummies, destructible walls
src/audio.js          procedural sound effects
src/maps/testRange.js the map (data + build function)
```

To add a map, copy `src/maps/testRange.js` and change the boxes. Each map defines `spawn`, `build(world)`, `dummies` and `walls`.

## Roadmap

- [ ] Online multiplayer
- [ ] Real maps
- [ ] More weapons and classes (light / medium / heavy)
- [ ] Enemies / players
