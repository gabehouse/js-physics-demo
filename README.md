# JS Physics Demo

Open `index.html` in a browser (or serve the folder). Flick, drag, or slam the yellow ball. Knobs are at the top of `index.js`.

## How the system works

The scene is a 2D canvas: sky, ground, and one ball. The ball has position, velocity, spin, and a soft contact with the floor and side walls.

**Simulation vs display.** Physics steps at a fixed 120 Hz (`FIXED_DT`) so the same swing feels the same on 60 Hz and 180 Hz screens. Each animation frame advances as many steps as time requires, then **interpolates** the last two poses for drawing. The canvas backing store is roughly native resolution (not a forced 2× buffer) so high-refresh 1440p stays smoother.

**Hits.** Cursor motion is recorded for a short window (`HIT_LOOKBACK`). Speed is `distance / time` over that window, not per-event jitter. A dead zone ignores crawls. Everything else maps **linearly** up to `MAX_SLAM_CURSOR`, which is treated as a full slam and scaled so the bounce reaches about the top of the window. Off-center hits add spin (`r × Δv`). Dragging follows a spring (`GRAB_K`) and can wind up spin if you swipe around the ball. A short tap is a poke.

**Flight.** Gravity, light air drag, spin decay, and a small Magnus force (sidespin curves the path). Speed is capped at `MAX_SPEED`.

**Contact.** Floor and walls are the same spring-damper: acceleration `-k * penetration - c * velocity`. The center of mass moves *into* the surface, up to `MAX_PEN`. Past that, velocity flips with `BOUNCE_E`. Surface **grip** uses slip (`v_tangent - ω R`) so sliding becomes rolling. On the floor, once the ball is slow and close enough (`REST_SPEED` / `REST_ALIGN`), it snaps to rest and can still roll out.

**Look.** `SQUASH_AMOUNT` only changes how flat the ellipse is drawn. Scale is pinned to the contact face (bottom on the ground, side on a wall). A stripe rotates with `angle`. Highlight and ground shadow share one light (high, slightly left, set in `layout()`).

World coordinates stay at `2 ×` CSS pixels internally so existing constants stay consistent; drawing is scaled down to the canvas.

## Parameters

### Look

| Variable | What it does |
| --- | --- |
| `rad` | Ball radius (world pixels). Changing this also changes `BALL_I` and `MAX_PEN`, which are derived from it. |
| `SQUASH_AMOUNT` | Visual flatten at full compression. `0` = always a circle, `0.4` = strong pancake. Does not change bounce feel. |
| `SHOW_DEBUG` | Draw floor and wall guide lines. |

### Motion and bounce

| Variable | What it does |
| --- | --- |
| `GRAVITY` | Downward acceleration. Higher = faster falls, less hang time. Also used when scaling a max slam to screen height. |
| `MAX_SPEED` | Hard cap on linear speed. |
| `AIR_DRAG` | Air resistance. Higher = flight dies out sooner. |
| `BOUNCE_E` | Restitution when travel hits `MAX_PEN`. `1` = lively, lower = deader. |
| `CONTACT_FRICTION` | Extra slide damping on a surface (alongside spin grip). |
| `GROUND_FRICTION` | Extra damping after it has settled on the floor. |
| `REST_SPEED` | How slow it must be before it can snap to rest. |
| `REST_ALIGN` | How close to the floor (pixels) before that snap. |

### Squash feel

| Variable | What it does |
| --- | --- |
| `SQUASH_K` | Spring stiffness into a wall or the floor. Higher = firmer, less sink. |
| `SQUASH_C` | Damping while compressing. Higher = stronger brake during the squash. |
| `MAX_PEN` | How far the center can move into a surface. Past this, velocity flips with `BOUNCE_E`. |

### Hitting and throwing

Cursor speed is measured in world pixels per second.

| Variable | What it does |
| --- | --- |
| `HIT_LOOKBACK` | Milliseconds of cursor path used to measure a swing. |
| `HIT_NOISE` | Swings slower than this (px/s) are ignored. |
| `MAX_SLAM_CURSOR` | Cursor speed treated as “as hard as possible.” Lower = more sensitive hits. A full slam is scaled to bounce near the top of the screen. |
| `POKE_SPEED` | Launch from a short tap (no drag). |
| `GRAB_K` | How hard the ball is pulled toward the cursor while dragging. |
| `GRAB_DAMP` | How quickly that follow damps out. |

### Spin

| Variable | What it does |
| --- | --- |
| `BALL_I` | Moment of inertia (`0.4 * rad²`, solid sphere). Higher = harder to spin up. |
| `SPIN_FRICTION` | Grip on floor and walls. Converts sliding into rolling (and the reverse). |
| `SPIN_AIR` | How fast spin dies in the air. |
| `MAGNUS` | Curve in flight from spin. `0` turns that off. |
| `MAX_OMEGA` | Cap on spin rate (rad/s). |
| `HIT_SPIN` | How much an off-center flick or grab adds spin. |

### Timing

| Variable | What it does |
| --- | --- |
| `FIXED_DT` | Physics step (`1/120`). Leave this unless you want a different sim rate. |
| `MAX_FRAME_DT` | Ignores huge pauses (tab switch) so the sim does not catch up in one burst. |
| `MAX_STEPS` | Max physics steps per displayed frame. |

## Files

- `index.html` — page shell and intro links
- `index.css` — layout and intro styling
- `index.js` — simulation, input, and drawing
