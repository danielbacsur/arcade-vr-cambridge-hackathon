# Arcade VR proxy · 0.8.0

The original Arcade website is served through a fixed-host proxy. Paths and query parameters are preserved. Only the editor’s `/play/<uuid>` page is replaced with the player wrapper.

## Addresses

| Original | Hosted proxy |
| --- | --- |
| `www.tryarcade.com` | `www.tryarcade.danielbacsur.dev` |
| `editor.joinarcade.ai` | `editor.joinarcade.danielbacsur.dev` |
| `dashboard.joinarcade.ai` | `dashboard.joinarcade.danielbacsur.dev` |

`runtime.joinarcade.danielbacsur.dev` contains the isolated original game with the injected engine adapter. `api.joinarcade.danielbacsur.dev` forwards only Arcade’s fixed API upstream. The existing domain root is a separate website.

## Player

Mode selection uses `navigator.xr.isSessionSupported('immersive-vr')`, with no manual override. Desktop shows equally sized 16:9 live and first-person views on a black first viewport, and controls below. The game iframe has a fixed 1920 × 1080 CSS viewport scaled into its preview; the head canvas also has a 1920 × 1080 output. Arcade’s HUD therefore keeps its normal desktop proportions. The default debug scene renders at 960 × 540 and the extra camera updates at up to 30 fps, independently of the DOM layout. VR uses native WebGPU XR where supported, otherwise a WebGL XR display fed by Arcade’s WebGPU stereo cameras. Connection retries automatically. Drag the first-person view to look around. Movement follows its heading; the real character’s body and head follow directly. The avatar is hidden from its own camera.

The Enter VR button appears after the game world is ready. Tapping it requests the immersive session; loading cannot open that browser prompt automatically. Browsers with XRGPUBinding use the engine’s native XR camera. Other VR browsers, including the standard Quest path, retain Arcade’s required WebGPU renderer and transfer a side-by-side stereo ImageBitmap to a separate WebGL XR layer. Headset poses drive both eye transforms, projection matrices and character head direction; the left controller stick supplies movement. The bridge drives game updates from the headset clock because ordinary window animation frames may pause during immersion. Only the eye cameras render during the session. Exiting restores the original animation loop and first-person canvas. Eye resolution is capped at 1536 × 2048 per eye pending Quest performance measurements. Actual headset entry, latency, performance and controller interaction remain unverified on hardware.

The previous bootstrap removed navigator.gpu when XRGPUBinding was absent. Arcade is WebGPU-only, so that caused the loading stall. The bootstrap now leaves navigator.gpu intact. An experimental WebGL conversion degraded terrain/materials and was discarded.

Desktop debug retains the original camera and an offscreen head camera. GPU copies deliver the head camera to the wrapper. First-person production rendering disables native cameras and renders only the injected camera. Resolution, color and diagnostics are below the desktop views.

## Local run

Run `python3 server.py` in this folder, then open `http://localhost:8765`. Local editor addresses use `editor.joinarcade.localhost:8765`, with identical paths. The browser extension is unnecessary for the proxy workflow. The older separate extension/relay experiments remain available at `/lab.html`; their local capability file is excluded from deployment.

## Vercel

`api/index.py` adapts the fixed-host Python proxy. Native external rewrites forward engine libraries and Google Storage assets. Editor and storefront bundles pass through text rewriting, with gzip compression for large bundles; popup location assignments are also mapped, covering Arcade’s asynchronous blank-tab launch. Injected network mapping keeps API calls on the proxy, even when the frontend bundles are served without text rewriting. Each custom hostname must belong to the new `arcade-vr-proxy` project.

Sessions use host-only cookies. Request origins are translated to their fixed upstream equivalents; CORS responses are translated back only for recognized proxy hosts. Unknown incoming hosts are rejected. Logging omits query strings.

Public browsing and games are the verified scope. Account login, editor saving, multiplayer/WebSocket flows, voice chat and native Quest operation need separate validation. The proxy is not an arbitrary upstream gateway.

## Earlier performance evidence

The first-person-only desktop prototype measured approximately 57 fps at 720p and 54 fps at 1080p for transferred GPU frames, compared with 12 fps at 640 × 360 using CPU pixels. Those figures are from the earlier one-camera mode, not the new two-camera debug mode or Quest hardware. The experimental WebRTC transfer failed and is not exposed in the current UI. Historical notes in `EXPERIMENTS.md` describe superseded prototypes and are not the current feature contract.
