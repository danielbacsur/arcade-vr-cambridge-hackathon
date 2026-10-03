# Arcade VR integration lab

This lab tests access to Arcade from a Chrome extension, an embedded page, and a local middleware server. It also includes a deliberately limited public-player proxy. It is an integration prototype, not a VR implementation.

The extension was loaded and exercised in Chrome on 3 October 2026. It accessed the actual PlayCanvas application, active camera, and 473 scene entities in Arcade's public Tidy Library game. Camera commands worked and restoration worked. During active play, the normal camera controller subsequently overwrote the injected transform.

Read [the architecture report](ARCHITECTURES.md) for the full findings and alternative plans.

## Character controller (v0.6.0)

Open **http://localhost:8765/controller.html** in Chrome with the lab extension. Paste an Arcade editor `/play/<uuid>` URL into **Game URL**, then **Load game**. Start the embedded game, then press **Connect controls & camera**. The supplied Purrbound Island test is available at:

http://localhost:8765/controller.html?game=https%3A%2F%2Feditor.joinarcade.ai%2Fplay%2F97ef3f49-5ef4-4a73-8f92-983c81b6a928

- Drag **Player’s perspective** to look around. Its yaw/pitch are independent of the original camera. Looking no longer writes to the original camera rig.
- The player body is invisible in **Player’s perspective**, including when looking down. The comparison mode still renders the avatar through the original gameplay camera. First-person-only mode disables the original camera’s rendering while retaining its logical pose for native movement. The filter covers render/model meshes under the controlled character, including meshes loaded later; Stop restores their original visibility callbacks and culling settings.
- Move with the outside joystick, direction buttons, WASD, or arrows. Input is transformed from the head-view basis into the original game-camera basis, so native physics processes movement in your viewing direction even when the original camera looks elsewhere.
- Arcade’s stock character faces +Z and the camera looks along −Z. Character yaw therefore uses a 180° offset from head-view yaw. This corrects the previous character-facing-camera mistake.
- E, Space, Shift and game actions are forwarded to the embed. **Game key** accepts one letter or digit; hold its button to forward it. For Purrbound Island use F (battle), R (befriend), Q (recall). Letter/digit keys also forward when the wrapper is focused. Game-specific outcomes still depend on nearby objects and game state.
- **Stop / release** releases input and removes the added camera/source/render target. Heartbeat, blur and pointer cancellation release input.

The head bone now receives an absolute orientation from the current view pose after animation evaluation. A fixed model-axis calibration replaces the previous additive animated-head pose, so native head/aim easing cannot affect yaw or pitch. Arcade’s separate `_MoldYaw` visual wrapper also receives the desired body yaw directly at render time; changing only the physics root did not control this wrapper. Both original local rotations are restored after rendering and on Stop, so normal animation evaluation continues. Head discovery retries when an avatar rig loads late. Diagnostics includes **Test instant head response**, which checks abrupt yaw/pitch changes immediately and again 150 ms later; **Test animated head tracking** checks the rendered head target. Older `head-tracking-test.json` records the v0.5.1 additive pitch implementation.

The separate camera follows the `mixamorig:Head` joint, with a generic head-name search and root-plus-height fallback. The default first-person-only path renders one camera at 1280 × 720 and transfers ImageBitmap frames through validated iframe `postMessage`. It avoids explicit RGBA readback, CPU row flipping and ImageData allocation. Capture runs after PlayCanvas submits WebGPU commands in `graphicsDevice.frameEnd`; capturing in `postrender` produced black images because submission happens later. Stop restores the original frameEnd function. The original 640 × 360 / 12 fps pixel path remains available for comparison.

### Measured compatibility

Both tests used the same `arena.js`, with no game-ID-specific branches:

| Game | Forward distance | Direction alignment | Head aligned | Original camera angle unchanged |
| --- | ---: | ---: | --- | --- |
| Six Seven arena | 4.39 m | 0.99999993 | Yes | Yes |
| Purrbound Island | 3.37 m | 0.99988656 | Yes | Yes |

See `independent-six-seven-test.json`, `independent-purrbound-test.json`, and `independent-purrbound-proof.png`. **Test look & forward movement** in diagnostics repeats the actual test, then restores the head's original look direction. It moves the player; use it away from obstacles. **Save diagnostics** downloads the result. Older `control-*` evidence records the previous coupled-camera implementation.

The current adapter discovers Arcade's controlled entity and input manager through shared runtime services. These two third-person character games are validated. First-person discovery paths exist but a first-person game has not yet been validated. Custom script-driven movement, different model forward axes, unusual head joints, vehicles and bespoke camera bases may need small compatibility adapters. This is a reusable Arcade experiment, not a guarantee for every generated game.

Direct-only operations are `runtime.inspect`, `controls.connect`, `controls.input` (normalized x/z and key codes), `controls.look` (absolute yaw/pitch degrees, relative `delta`, or quaternion reduced to yaw/pitch), `controls.status`, `controls.body` (`visible: true` temporarily shows the avatar in the head feed; hidden is the default), and `controls.stop`. Connected sessions stream transferable ImageBitmap frames, encoded video, or comparison pixel buffers and player/head-camera telemetry at 5 Hz. High-frequency input and look messages use lightweight acknowledgements. Both sides validate the iframe window and origin. The original camera retains its logical pose for native movement; its rendering is disabled in first-person-only mode and restored by Stop.

### Rendering and color controls

- **Resolution:** 960 × 540, 1280 × 720, or 1920 × 1080. Fixed output resolution prevents device pixel ratio from silently multiplying GPU work.
- **GPU frames:** local transferable ImageBitmap feed, one in flight, acknowledged by the wrapper. This is the default desktop path.
- **Encoded video:** real canvas capture with a local WebRTC peer pair. H.264 is preferred, with codec fallback if unavailable; target bitrate is 10 Mbps at 720p and 18 Mbps at 1080p. Signalling is carried through the existing iframe channel. This proves local encoded delivery; a headset network/signalling service is still needed for another device.
- **Direct game view:** use the first-person engine canvas itself, with no image transfer or decode. It is the lowest-overhead option for a same-device renderer.
- **Original comparison:** retains the original camera and an offscreen head camera with 12 fps pixel transfer.
- **Color:** sRGB output into an sRGB wrapper canvas, with Neutral highlight compression by default; ACES remains selectable. Exposure multiplies the game’s saved scene exposure and restores it on Stop. Keep colors configurable because generated games use different lighting.

Only the injected head camera renders in optimized modes. Avatar discovery is limited to once per second and telemetry to five updates per second. Input and game simulation remain active. Stop restores camera enablement, canvas resolution/pixel ratio, exposure, bone rotations, visibility callbacks and the frame-end hook.

Keep the engine iframe visible and the tab foreground during measurements. Chrome pauses/throttles an offscreen cross-origin iframe; the benchmark automatically scrolls to the live views. Rendering both visible views shows the same single engine camera—the wrapper copies its output rather than drawing the scene twice.

For Quest 3, choose headset runtime-recommended eye-buffer dimensions for a future native XR mode rather than equating a 1080p mono video with the headset’s panel resolution. A Quest XR renderer, stereo rendering, roll-aware tracking and cross-device encoded delivery remain separate work. No Quest 3 hardware frame rate or motion-to-photon latency has been measured here.

References: [Meta WebXR performance](https://developers.meta.com/vr/documentation/web/webxr-perf-bp/), [Meta render scale](https://developers.meta.com/vr/essentials/render-scale/), [Meta browser video support](https://developers.meta.com/vr/documentation/web/browser-video/) (VP8 has no hardware decoder on Quest 3/3S), and [PlayCanvas tone mapping](https://developer.playcanvas.com/user-manual/graphics/cameras/tone-mapping/).

## Run the lab

1. Run `python3 server.py` from this folder. It binds to `127.0.0.1:8765` and prints the lab URL. Use `http://localhost:8765` in the browser.
2. Open `chrome://extensions`, enable Developer mode, and use Load unpacked to select the `extension` folder. This was already done on the device used for the experiment.
3. Open `http://localhost:8765`. Choose Local fixture to validate the bridge, or load your Arcade public player URL.
4. For an embedded page, select Direct iframe postMessage. For an Arcade page in another tab, select Local middleware relay and select that page's session.
5. Read runtime, check XR, and read scene transforms. Camera writes require Arm camera writes in the panel inside the target page. Restore camera or Restore / disarm resets the saved transform.

`extension/config.json` is generated on the first server run. It contains a local lab capability token, not an Arcade account token. Keep the file consistent with the running server. Reload the extension after changing extension files or regenerating its configuration.

The extension matches the marketplace, dashboard, editor, and localhost. The isolated relay only runs on Arcade pages and the local fixture. It never reads account storage or authentication tokens. Different frames get different sessions; choose the `/play/…` game frame, not `/blitz-panel/index.html`.

## Files and responsibilities

| File | Purpose |
| --- | --- |
| `extension/adapter.js` | Runs in the page's MAIN world; reads engine state and executes a narrow command set |
| `extension/content.js` | Runs in the extension's isolated world; forwards approved replies and polls for commands |
| `extension/background.js` | Makes local relay requests from the extension context |
| `server.py` | Serves the harness, queues commands, records replies, and serves a partial public asset proxy |
| `web/harness.js` | Our app; selects a frame/session and sends requests |
| `web/fixture.js` | Synthetic camera contract for repeatable transport and restoration tests |

## Supported messages

Requests contain `channel: "arcade-vr-lab-v1"`, `direction: "request"`, a unique `id`, an `op`, optional `payload`, and an optional target `session`. Replies repeat `id` and include `ok`, `result` or `error`, and the actual session.

| Operation | Result or effect |
| --- | --- |
| `ping` | Echoes a payload from the page context |
| `describe` | Engine version, application availability, camera pose, render backend, and XR indicators |
| `xr.check` | Also asks the browser whether an immersive VR session is supported |
| `scene.snapshot` | Up to 1,000 entity IDs, parent IDs, names, transforms, and component indicators |
| `camera.pose` | Sets one camera pose when explicitly armed; accepts `position` and `euler`, each with finite `x`, `y`, `z` |
| `camera.restore` | Restores the first saved pose and disarms camera writes |

The snapshot does not export geometry, materials, animations, scripts, physics bodies, or authoritative game state. Euler angles are adequate for these tests; the VR protocol should use normalized quaternions and timestamps.

## Transport behavior

The iframe bridge validates the parent origin and window source. Parent origins are currently `http://localhost:8765` and `http://127.0.0.1:8765`. Change that allowlist deliberately when building your own hosted app.

The local relay polls commands every second and results every half second. A fixture round trip measured 710 ms; a live player round trip measured 571 ms. This proves connectivity, not suitability for tracking. Replace polling with WebSocket or WebRTC for interaction; keep head tracking local to the headset renderer.

Events and pending commands are stored in memory and reset when the server restarts. Requests have timeouts, but queued commands are not canceled on timeout. Do not stream camera writes through this polling prototype. Keep the server on loopback for this experiment; a Quest on Wi-Fi cannot reach the desktop's localhost. Device delivery needs a separate HTTPS/WSS endpoint or a USB development workflow.

## Proxy experiment

Public player proxy serves Arcade's public player HTML and selected public assets from `editor.joinarcade.ai` under the lab's origin and inserts `adapter.js`. It preserves upstream embedding/security headers, forwards no account cookies or authorization, and accepts no arbitrary upstream host.

In the extension-free in-app browser, the injected adapter answered messages and the parent could access the proxied page. The player failed its backend fetch: Arcade's API returned no `Access-Control-Allow-Origin` for localhost, while it returned the editor origin for the original player. This is not a complete origin migration. Missing asset paths and hardcoded API/WebSocket URLs also need attention. The added asset prefixes after the first proxy run have not been rerun end to end.

## Evidence

- `browser-test-log.txt`: fixture messaging, camera write gating, camera restoration, and direct Arcade iframe ping.
- `live-relay-test-log.txt`: real player camera commands and the later active-play camera sample.
- `test-events.json`: relay events including the 473-entity real scene snapshot.
- `unmodified-frame-log.txt`: no reply to our protocol without injection.
- `proxy-test-log.txt`: extension-free proxy injection and ping.
- `public-player-headers.json`: embedding header inspection.
- `iframe-extension-proof.png`, `live-game-proof.jpg`, `proxy-proof.jpg`: browser evidence.

## Finish a session

Use Restore / disarm on any page where writes were armed. Stop the server with Ctrl-C. Disable or remove Arcade VR Integration Lab from `chrome://extensions` when finished; Developer mode was enabled for loading this local extension. Closing/reloading a page removes that page's injected adapter. Remove panel only hides the panel and disarms writes; the message listener remains until the page closes or reloads.

The v0.5.2 body filter uses PlayCanvas 2.22’s camera-specific mesh visibility callback: https://github.com/playcanvas/engine/blob/v2.22.0/src/scene/mesh-instance.js. It preserves pre-existing callbacks and normal visibility for other cameras; materials are unchanged. Diagnostics includes **Test hidden body looking down** (sets pitch to −80° and checks live head-camera exclusions, other-camera visibility checks, and continuing frame delivery).

Live verification on Purrbound Island passed at −80° pitch: three avatar meshes excluded from the head camera, other-camera checks preserved, and frame delivery continued. See `body-hidden-test.json` and `body-hidden-proof.png`; the screenshot shows the avatar in the original view and unobstructed terrain in the head feed.

Live v0.5.3 snap-turn verification passed on Purrbound Island for (yaw,pitch) = (−110°,60°), (95°,−55°), and (0°,0°). Immediate and 150 ms later head target errors were below 0.000012°, with drift below 0.000008°. The visual wrapper also matched the requested body heading. See `instant-head-test.json` and `instant-head-proof.png`. This removes pose easing; the approximately 12 fps streamed feed still has its existing update interval.
