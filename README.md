# THE SEMI-FINALS

A browser FPS in the spirit of The Finals, with a white grid sandbox look.

**Build 0.31: no more gaps.** Every part of every gun (and every one of the 49 attachments, in every combination) now touches the rest of the gun: attachments measure the gun's real surfaces and sit flush, swapped stocks get a link to the receiver, and the models were fixed where pieces floated. Guns get a worn metal finish (grain, machining streaks, paint worn bright on the edges) with no cartoon outlines, and the hands are smooth with overlapping finger joints and a wrist joining each hand to its sleeve. **Build 0.30: proper first-person hands** (jointed fingers, a thumb, a trigger finger, a C-clamp support grip, tapered sleeves, glove cuffs and a watch; bare skin or gloves to match your class and cosmetics). **Build 0.29: every gun has its own model and its own reload.** The ten newer guns were rebuilt from scratch (a proper six-barrel minigun, an AA-12-style drum shotgun, a break-action side-by-side, a brass lever-action, a real swing-out revolver, a Vector-style SMG and more), the original six got extra detail, and all 16 reload differently. Also: 49 attachments with a Delta Force-style gunsmith and a Battlefield 2042-style quick swap (hold B), online 1v1/2v2, and 4v4 team deathmatch against AI.

## Run it

It's plain HTML + JavaScript with no build step and no dependencies. Browsers block ES modules from `file://`, so serve the folder with any static server:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000.

**After pulling an update**, hard-refresh (Ctrl+Shift+R, or Cmd+Shift+R on Mac). The home screen shows the build number (top left, e.g. `BUILD 0.21`) so you can check you're on the latest. Every script is loaded with a version stamp (an import map in `index.html`), so a refresh always gets a matching set. After changing files in `src/`, run `python3 tools/stamp.py` to update the stamp.

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
| E | Take a gun from a case, use the workbench, press a lift button, pick up / deposit the cash box |
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

## Matchmaking (build 0.20)

PLAY runs a match lobby before you drop in:
1. **Finding match.** 12 contestant slots fill up as players are found. Cancel (or Esc) takes you back.
2. **Match found.**
3. **Choose your loadout: 30 seconds.** Pick your class, primary weapon and specialisation. Your contestant changes on screen as you pick. Your team panel shows each teammate's class and when they lock in. Hit LOCK IN (or Enter) and the match starts a few seconds later; when the clock runs out you go with what you've got.
4. **Team intro.** Four teams of three slide in. Team names are drawn at random from a pool of five (The Gold Rush, Neon Vandals, Sky Sharks, Vault Breakers, Lucky Strikes), and player handles are generated from name parts (NOVAFOX22, RONINRUSH31...). Your team is highlighted. The top 2 teams advance to the final.
5. **DROP IN.** In the arena, the four teams and their cash sit along the top of the HUD.

After that, PLAY resumes your match until you change your loadout.

## The arenas (build 0.26)

Three small walled arenas in the test range's style: white grid blocks, charcoal trim and pilasters, red light strips, and floodlights in the corners. The obstacles are simple and chunky: cubes, low and tall walls, pillars, platforms with stairs. Every layout is point-symmetric, so neither team has the better side. Each team spawns in a dark zone at its end; a red line marks halfway.

- **BLOCKYARD** (68 × 48 m): a raised centre platform with stairs on both sides and cover on top, surrounded by cubes, pillars and walls.
- **THE SPLIT** (72 × 52 m): a dividing wall down the middle with three gaps (the centre one half-blocked), a hut on each side with doors front and back, and a side deck with stairs.
- **HIGH GROUND** (80 × 52 m): a 4.2 m lookout with parapets near each spawn, a low side deck each, and staggered trench walls and big rounded blocks through the middle.

Matchmaking picks one at random. The bots can path anywhere, including up the stairs onto every platform.

## Team deathmatch (build 0.26)

PLAY → matchmaking → loadout (30 s) → team intro → a 4v4 team deathmatch: you and three AI teammates against four AI enemies. Every elimination scores a point for the other team, and **the first team to 10 kills wins** and advances to the final. You respawn at your team's end after 3 seconds; bots come back after 4. There's no friendly fire.

On the HUD: both teams' kill counts along the top and the score (in the leading team's colour) underneath. Teammates always have their name and health shown; enemies only when you can see them. Kills show in the kill feed.

**The AI (build 0.27)** no longer knows where you are. A team only knows what its members have seen or heard: sightings are called out to the whole team instantly, gunfire gives away your rough position to any enemy within ~38 m (vaguer the further away), and getting shot reveals the shooter. Intel goes stale after 9 seconds.
- **Roles:** two bots push the middle and one flanks down each side, swinging wide of the last known position. Heavies anchor on raised platforms on their half and only leave to chase someone close.
- **Fighting:** a short reaction delay (less than half as long if you appear where they were already watching, since they pre-aim last known positions), aim that improves the longer they track you (and learns a predictable strafe), focus fire on whoever their team is shooting, strafing while firing, ducking into cover between bursts and while reloading.
- **Magazines:** bots run dry and take about 2 seconds to reload, which is your window.
- **Staying alive:** badly hurt bots fall back to a teammate and heal after 5 seconds out of the fight; when their team is outnumbered by two or more they hold position instead of charging in.

## Online (build 0.27)

Home → **ONLINE**. Pick a name, then:
- **Host a room:** choose **1V1** or **2V2** and an arena (or random), press HOST, and send the 5-character room code to your friends. In 2v2 the host can swap players between teams (⇄). START MATCH once both teams have someone.
- **Join a room:** type the code and press JOIN.

It's team deathmatch, first to 10 kills, with your own class and loadout. Rooms run peer-to-peer over WebRTC: [PeerJS](https://peerjs.com)'s free public server only brokers the handshake, and the host relays game traffic between players. Each player simulates their own movement and reports position about 20 times a second, plus their shots (for tracers) and hits (the player who was hit takes the damage). The host keeps the score. There's no anti-cheat; play with people you trust. Very strict networks (some school or work Wi-Fi) can block WebRTC.

For testing, add `?net=local` to the URL and two tabs in the same browser can play each other without the internet.

## Guns (builds 0.27–0.28)

| Gun | Type | Class | Notes |
| --- | --- | --- | --- |
| BR-3 | Burst rifle | Medium | Three-round bursts (tap to fire one), 23 damage, tight spread |
| FC-308 | Marksman rifle | Medium | Semi-auto, 44 damage, 15 rounds, long barrel |
| BX-56 | Bullpup rifle | Medium | Mag behind the grip: compact, quick to aim |
| DB-2 | Double barrel | Medium | Two shots of 12 pellets, then crack it open |
| MP-9 | Machine pistol | Light | 1,100 RPM, 24-round extended mag |
| KV-45 | SMG | Light | 1,250 RPM with almost no kick |
| LV-44 | Lever rifle | Light | Iron sights, 68 damage, 8 rounds, worked by a lever |
| R-357 | Revolver | Light, Heavy | Six shots, 58 damage, heavy recoil |
| AS-20 | Auto shotgun | Heavy | Mag-fed, 8 pellets, 210 RPM |
| ROTARY-X | Minigun | Heavy | Spins up for 0.55 s (hold fire or aim to keep it spinning), then 1,600 RPM from a 250-round box |

Every gun has its own model (build 0.29), and every gun reloads differently:

| Gun | Reload |
| --- | --- |
| SF-47 | Rolled in, mag flicked out, fresh one twirled in and slapped, charging handle, barrel-roll finisher |
| BR-3 | Tilted left, mag swap, palm-slaps the bolt release, snapped back up |
| FC-308 | Pulls the mag and checks it, tosses it, seats a fresh one, works the op-rod |
| BX-56 | Nose up and rolled toward you to reach the mag behind the grip, forward charging handle |
| V9-S | One wrist flick throws the mag out, new one in, full barrel roll |
| KV-45 | Mag swap, then the whole gun flipped end over end and caught |
| MP-9 | Turned on its side, the empty drops free, new mag slammed up the grip, bolt yanked |
| P-19 | Mag swap with a full twirl and a gunslinger spin |
| R-357 | Cylinder swings out, muzzle up to dump six brass, speedloader in, flicked shut with a spin |
| SG-12 | Shells fed one at a time, spin-cocked when empty |
| AS-20 | Rocked over, drum rocked out and a fresh one rocked in, side handle slapped |
| DB-2 | Broken open (the barrels hinge down), two empties pop out, two shells thumbed in, snapped shut, hammers cocked |
| LH-7 | Mag swap from underneath, then the bolt lifted, run back and slammed home |
| LV-44 | Rounds pushed in through the loading gate one at a time, then the lever worked |
| M60-X | Feed cover flips up, box swapped, belt laid in the tray, cover slammed |
| ROTARY-X | Hefted over, ammo box unhooked and a full one hung on, belt clipped to the chute, spin test |

The newer guns take the attachments of the type they're closest to, with their own mounting points (a bullpup has no stock slot, the double barrel has no magazine/barrel/muzzle, the minigun only takes optics, side rail, box and ammo).

**The armoury:** there are no glass cases any more. Every gun sits muzzle-down in one of two open wooden crates either side of the workbench, with the stocks sticking out. Look at one (it lifts and glows) and press E to take it.

## Attachments (build 0.28)

Eight slots, 49 parts. Each changes the gun's model and stats:
- **Optic (9):** mini red dot, holo, reflex, Kobra 1.25×, 2× prism, 3× combat scope, 4×, 6× and 8× scopes.
- **Muzzle (8):** suppressor, heavy suppressor, compensator, muzzle brake, flash hider, linear comp; full choke and duckbill for shotguns.
- **Barrel (5):** long, CQB, heavy, fluted, match.
- **Underbarrel (6):** vertical, angled, stubby, ergo grip, handstop, bipod.
- **Side rail (4, new):** red laser, green laser, tactical light, laser-light combo.
- **Magazine (5):** extended, fast, drum, mag coupler, polymer.
- **Stock (5):** light, heavy, padded, folding, none.
- **Ammo (7, new):** hollow point, armour piercing, subsonic, high velocity, match grade; slugs and dragon's breath for shotguns. Ammo shows as a coloured band on the mag.

**Gunsmith (workbench, like Delta Force's):** the gun sits side-on in the middle of a dark studio, with every slot pinned to its spot on the gun by a leader line (gold when fitted). Click a slot to list its parts; every card spells out its pros (green ▲) and cons (red ▼) against your current build, and hovering previews the change on the stat bars (damage, fire rate, DPS, range, accuracy, recoil, handling, mobility, magazine, zoom, hip fire, stealth, reload). Guns are listed down the left by type. Drag to turn the gun.

**Quick swap (hold B, like Battlefield 2042's plus menu):** a menu opens around your crosshair with optics up top, underbarrel on the left, muzzle on the right and ammo below. Move the mouse to steer the cursor and click a part to fit it. Your ammo carries over (swapping doesn't refill the mag) and the gun takes a moment to settle.

## Performance (build 0.25)

- Scenery that never moves (container stacks, hull, deck clutter, rails) is grouped into 28 m chunks and drawn with
  instanced draw calls (`src/batch.js`): roughly 130 draws instead of ~1,700. Anything that later moves, changes colour
  or is broken drops out of its batch automatically and is drawn on its own.
- Characters and props far from the camera use low-poly spheres, capsules and rounded boxes, and the shadow map always
  uses the low-poly versions. Off-screen character parts are culled, and only those within ~32 m cast shadows. This cut
  the vertices per frame from ~7 million to under 0.5 million.
- Dynamic resolution: if frames take longer than 1/50 s, the render scale drops (down to 55%) and comes back up when
  there's headroom. Pixel density is capped at 1.5×.

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
src/batch.js          static scenery batching (instanced draws per chunk)
src/world.js          box list, spatial grid, collision queries, raycasts
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
src/maps/arenas.js    the three semi-finals arenas (layouts as data + a shared builder)
src/tdm.js            team deathmatch: scoring, respawns, team AI (intel, roles, reloads)
src/bench.js          the gunsmith (workbench overlay)
src/net.js            online rooms: transports (PeerJS / BroadcastChannel), lobby, remote players, sync
src/nav.js            bot navigation: walkable grid per level, stair links, A*
src/matchmaking.js    PLAY flow: matchmaking, 30 s loadout pick, team intro
```

To add an arena, add a layout to `LAYOUTS` in `src/maps/arenas.js`: blocks `b`, platforms `p`, stairs `s` and huts `hut`, listed for one team's half (they're mirrored for the other) or under `mid`. The builder adds the walls, floodlights, spawn zones and the bot navigation for every platform. Arenas live 700 m from the range; only the place you're in is drawn.

## Roadmap

- [ ] Online multiplayer
- [x] First real map (Fortune Stadium)
- [ ] More modes for the arenas
- [ ] More weapons and classes (light / medium / heavy)
- [ ] Enemies / players
