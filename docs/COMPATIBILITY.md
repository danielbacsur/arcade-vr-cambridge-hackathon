# Compatibility evidence

The live checker reads the entire public marketplace catalog, resolves each published play URL, checks runtime adapter injection, and compares sampled signed thumbnail/vignette bytes through the proxy. It also checks shader libraries, WASM and six skybox textures. Run `npm run coverage:live` against a running local server. Reports go to ignored `work/compatibility.json` and omit signed URLs.

The first sweep covered **121 public games and 346 requests**, with zero proxy discrepancies: 125 upstream HTTP 200 responses and 221 partial asset HTTP 206 responses matched. This proves transport/bootstrap coverage, not that every game reaches gameplay or every dynamic asset loads. The expanded shader/WASM/skybox sweep completed **352 checks**, also with zero discrepancies.

Browser checks found and fixed a relative-path regression: Arcade's `<base href="/">` must govern fetch/XHR texture paths. Resolving against the `/play/...` document instead returns an HTML fallback that cannot be decoded as an image. Six Seven Arena now reaches its original Start screen through the local proxy.

The supplied `PlYeZD5hGS7X` multiplayer server returns HTTP 404 and fails on the original site too. For a 404 join reservation with a valid marketplace return link, the adapter resolves the public game and opens a fresh quick match once. Browser validation reached a newly assigned server and the player-spawning stage. It does not silently recover 401/403 authentication errors or discard valid invitations.

Automated integration checks cover text/binary WebSockets and protocols, invalid origins, HTTP matchmaking through a WebSocket-derived URL, unknown hosts, signed query preservation, Range responses, streaming, CORS, safe-read retries, write non-replay and removal of credentials from unrelated asset hosts.

## Boundaries

An expired server is a different room; recovery preserves the game, not the old room's state. Private games, missing permissions, unavailable upstream servers and deleted assets remain upstream constraints. Connection duration on Vercel Fluid Compute is bounded, so the game must reconnect and resynchronize. Native WebSocket support is public beta; an ordinary Node server is the fallback deployment option.

Chrome is not currently available through browser tooling. Public comparison used the available in-app browser. No Quest is present. Device performance, immersion and hand interaction are separate hardware validation, not inferred from HTTP results.
