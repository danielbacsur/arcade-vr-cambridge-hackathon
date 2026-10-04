# Compatibility evidence

The live checker reads the entire public marketplace catalog, resolves each published play URL, checks runtime adapter injection, and compares sampled signed thumbnail/vignette bytes through the proxy. It also checks shader libraries, WASM and six skybox textures. Run `npm run coverage:live` against a running local server. Reports go to ignored `work/compatibility.json` and omit signed URLs.

The first sweep covered **121 public games and 346 requests**, with zero proxy discrepancies: 125 upstream HTTP 200 responses and 221 partial asset HTTP 206 responses matched. This proves transport/bootstrap coverage, not that every game reaches gameplay or every dynamic asset loads. The expanded shader/WASM/skybox sweep completed **352 checks**, also with zero discrepancies: 131 HTTP 200 and 221 HTTP 206 responses, no inconclusive requests. Reports now separate proxy discrepancies, inconclusive network checks and matching upstream failures; any of these makes the live check fail rather than silently pass.

Browser checks found and fixed a relative-path regression: Arcade's `<base href="/">` must govern fetch/XHR texture paths. Resolving against the `/play/...` document instead returns an HTML fallback that cannot be decoded as an image. Six Seven Arena now reaches its original Start screen through the local proxy.

The supplied `PlYeZD5hGS7X` multiplayer server returns HTTP 404 and fails on the original site too. For a 404 join reservation with a valid marketplace return link, the adapter resolves the public game and opens a fresh quick match once. Browser validation reached a newly assigned server and the player-spawning stage. It does not silently recover 401/403 authentication errors or discard valid invitations.

Automated integration checks cover text/binary WebSockets and protocols, invalid origins, HTTP matchmaking through a WebSocket-derived URL, unknown hosts, signed query preservation, Range responses, streaming, CORS, safe-read retries, write non-replay and removal of credentials from unrelated asset hosts.

## Boundaries

An expired server is a different room; recovery preserves the game, not the old room's state. Private games, missing permissions, unavailable upstream servers and deleted assets remain upstream constraints. Connection duration on Vercel Fluid Compute is bounded, so the game must reconnect and resynchronize. Native WebSocket support is public beta; an ordinary Node server is the fallback deployment option.

Chrome validation reached actual Six Seven and Purrbound Island gameplay and preserved its HUD, confirmed an outside joystick changed the player position, and verified matching desktop/mobile panes. Purrbound also verified the paired `editor.localhost`/`runtime.localhost` channel. Some material/variant requests return upstream 401 while the native game uses its own base-material/model fallback; those warnings are not reported as successful authenticated access. Original Arcade sign-in and native editor Box placement/Undo were also tested. The in-app browser verified fresh multiplayer recovery. No Quest is present. Device performance, immersion and hand interaction are separate hardware validation, not inferred from HTTP results.

## Actual GPU integration fixture

`npx tsx scripts/browser-fixture.ts` serves `http://127.0.0.1:8766`. Run the UI checks and GPU stereo checks. The latter uses a real WebGPU PlayCanvas scene with simulated eye poses and a capsule-centered test rig; it is not headset hardware validation. It verifies two 320 × 320 eyes, paired frame metadata, stereo disparity, sRGB color, transparent HUD compositing and restoration of the original animation loop, cameras, input source and size.

The passing probe produced a 640 × 320 bitmap, 1,296 red target pixels per eye, six pixels of stereo disparity, sRGB mid-red `[128,0,0,255]`, HUD alpha 128 and transparent corner alpha zero. A 50% yellow UI element now composites as `[128,128,0,255]` over black; before the fix it was `[64,64,0,255]` from double alpha multiplication. The browser also compiled the stereo/panel shaders and a panel ray clicked the original button. Chrome became unavailable when the Mac locked; the final GPU integration ran in the in-app browser.

## Integrated laptop stereo preview

The follow-up browser probe verifies two real desktop player cameras and the original engine HUD in both eye images, then enters the simulated-pose XR capture and checks all prior stereo/color/restoration assertions. The complete probe passes. Live Purrbound gameplay also displays its original DOM health/companion/action UI in both preview eyes; the screenshot is saved in `docs/assets/stereo-player-preview.png`. Desktop UI is overlaid directly on each eye for the jury demonstration; Quest retains spatial UI and native eye optics. All five features are merged into main, and strict types, lint, build and 63 tests pass.

## Head-following HUD and hand interaction

Gameplay now uses a view-following HUD instead of an anchored panel or browser-dependent DOM overlay. The editor remains spatial. A real browser probe rotates/translates the simulated head, clicks the original DOM button once, holds a joystick drag to full movement and verifies that a lost ray stops it. All checks pass. WebXR supplies hand poses and primary input events; Arcade's own player controller still implements movement. See the [hand input specification](https://immersive-web.github.io/webxr-hand-input/).

Recovery tests cover capture-stall timing, suspension, and bitmap cleanup on either half of a failed stereo/HUD capture. A headset restart is not diagnosed from these tests. Foreground stalls exit to the native game view; tap the game to resume VR. The stereo capture bridge uses a uniform 1600-pixel eye-buffer cap and up to 60 captures per second to reduce peak buffer pressure, with unchanged native eye projection and presentation clock.
