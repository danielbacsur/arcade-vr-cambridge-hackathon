# Deployment and runtime requirements

The checked-in configuration targets one Vercel project. The local delivery has not been pushed or deployed; existing live domains still run their earlier deployment.

## Hostnames

Set `ARCADE_DOMAIN=danielbacsur.dev` and attach these exact hosts to the same project:

| Host | Purpose |
| --- | --- |
| `www.tryarcade.danielbacsur.dev` | Original `www.tryarcade.com` website |
| `editor.joinarcade.danielbacsur.dev` | Editor and game wrapper routes |
| `runtime.joinarcade.danielbacsur.dev` | Isolated engine and XR session owner |
| `dashboard.joinarcade.danielbacsur.dev` | Original dashboard |
| `api.joinarcade.danielbacsur.dev` | Arcade API |
| `storage.joinarcade.danielbacsur.dev` | Signed storage assets |

Paths and queries forward one-to-one. The only special game routes are editor `/play/<uuid>` and `/mp`; other editor routes retain the original site. The runtime uses fixed asset/socket path prefixes for additional known upstream hosts. Do not expose a generic URL proxy.

## Vercel

Use Node 22.13 or newer, `npm ci`, and `npm run build`. `vercel.json` includes `dist/public` in `api/index.ts`, routes requests to that Node HTTP server and sets a 300-second duration. Enable Fluid Compute for native WebSocket upgrades. Vercel currently documents WebSocket support as public beta; connections close at the function's maximum duration. The Arcade client must reconnect/resynchronize. The proxy does not replay input or manufacture room state. [Vercel WebSocket guide](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

For a deployment that needs longer uninterrupted socket sessions, run the same compiled Node server behind HTTPS with HTTP upgrade forwarding. `HOST=0.0.0.0 PORT=8765 npm start` starts it after building. Keep the fixed host registry and forward original Host/protocol correctly. No Python service or relay is required.

## Browser and authentication

Immersive playback requires HTTPS, WebXR and WebGPU. Localhost is suitable for desktop development; a headset opening an ordinary LAN HTTP address does not gain secure-context APIs. The iframe grants `xr-spatial-tracking` and the runtime requests its own session from the original native game interaction.

Proxy and original hostnames have different browser storage. Logging into the original dashboard does not automatically authenticate the proxy. OAuth providers may require Arcade to register the new redirect origin. Do not copy tokens or weaken login checks. Public games can play anonymously when upstream permits them. The editor branch includes a narrowly scoped original-origin extension build as an alternative; it is prepared, not installed. [Editor review](REVIEW.md).

The consent prompt is browser-owned. An existing Start/game click requests XR while transient activation is active; page-load timers cannot grant consent. A refusal is respected, and the adapter does not add a redundant entry button. [WebXR rules](https://immersive-web.github.io/webxr/#dom-xrsystem-requestsession).

## Diagnosis

| Symptom | Distinguish and inspect |
| --- | --- |
| Loading assets stalls | Compare upstream status, MIME type and relative path resolution; HTML returned as an image is a routing defect |
| A shared multiplayer room fails | Check whether its join reservation exists upstream; expired 404 links can recover to a fresh match |
| 401/403 or unavailable private assets | Authentication/permissions; do not retry as if it were a public network failure |
| Multiplayer drops after about five minutes | Function lifetime; use the game's reconnect path or the long-lived Node deployment |
| No VR consent on page load | No qualifying activation; use the original native Start/game interaction |
| No immersive API | HTTPS, browser capabilities and iframe permissions; desktop fallback stays available |
| UI capture is incomplete | Use the view-following HUD and hand pointer; cross-origin frames and some rasterized CSS are unsupported |

For local asset diagnosis, append `diagnostic=1` to the game URL. It logs decode MIME/size and failed HTML paths without signed query strings. Local server diagnostics use `ARCADE_DEBUG=1`; keep ignored captures out of commits. The live compatibility report also omits signed asset URLs.
