# Arcade VR proxy

The original Arcade site is served through a fixed-host TypeScript proxy. Paths and query strings stay intact. Editor `/play/<uuid>` and `/mp` routes open a minimal player wrapper; its isolated runtime keeps Arcade's game and UI.

| Original | Proxy |
| --- | --- |
| www.tryarcade.com | www.tryarcade.danielbacsur.dev |
| editor.joinarcade.ai | editor.joinarcade.danielbacsur.dev |
| dashboard.joinarcade.ai | dashboard.joinarcade.danielbacsur.dev |

The runtime, API and storage use `runtime.joinarcade`, `api.joinarcade` and `storage.joinarcade` under the same domain. Unknown hosts and arbitrary asset destinations are rejected.

## Develop

Use Node 22 or newer. Python is unnecessary.

```sh
npm ci
npm run check
npm run dev
```

Open `http://localhost:8765`. Editor URLs use `http://editor.joinarcade.localhost:8765` with the original path and query. The server serves the latest build; rebuild after editing browser adapters. `npm start` runs the compiled server.

`npm run check` runs strict TypeScript, ESLint, integration tests and the production build. Dependencies and the lockfile are tracked; generated output, local credentials and diagnostic captures are ignored.

## Player

Desktop has matching 16:9 live and head views with controls below. Both retain a 1920 × 1080 layout while the scene's render budget is adjustable independently. Head-view dragging controls the character's look; movement follows its heading. Connection is automatic. Mode selection detects immersive WebXR support without a manual override.

Arcade requires WebGPU. Keep it enabled even on browsers without `XRGPUBinding`. The Quest rendering, tracking, hands and UI work is recorded in [the delivery checklist](docs/TODO.md). Hardware performance and comfort require a real headset; simulated checks are not hardware verification.

## Deploy

Vercel builds `api/index.ts` and the browser adapters. Attach all listed hostnames plus runtime, API and storage to the same project. WebSockets require Vercel Fluid Compute's native WebSocket support, currently public beta, or an ordinary Node server. Long-lived multiplayer connections must reconnect when the platform's function duration expires. The game's protocol owns reconnection; input packets are never replayed by the proxy.

Binary assets and event streams are forwarded without buffering the entire response. Signed query strings and Range requests are preserved. Failed safe reads receive bounded retries; writes are never automatically replayed. Cookies and origin headers are translated only within the known Arcade host family. Vercel platform credentials are removed before upstream requests.

No proxy can guarantee private, deleted, expired or broken upstream games. Compatibility reports must separate proxy failures from upstream and authentication failures. Nothing from the current delivery is pushed or published before review.
