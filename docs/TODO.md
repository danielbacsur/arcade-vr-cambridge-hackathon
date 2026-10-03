# Production and hackathon delivery

Work through these tasks in order. Significant changes get separate commits. Do not push or publish until Daniel reviews the result. Preserve the original Arcade site and game UI; desktop stays a minimal split preview and Quest uses immersive rendering automatically.

- [x] Remove obsolete extension, relay, fixture, raw evidence and prototype files from the production repository.
- [x] Replace Python and JavaScript sources with a TypeScript-only server and browser runtime; add strict checks, reproducible builds, linting and meaningful tests.
- [ ] Support single-player and multiplayer URLs, external asset hosts, streaming and multiplayer connections. Run a reproducible, broad compatibility matrix; identify upstream/authentication/network failures accurately.
- [ ] Request immersive entry at game readiness when the browser permits it; otherwise reuse the game's existing Start interaction, with no redundant entry button. Do not bypass browser consent or user activation requirements.
- [ ] Correct per-eye projection/aspect/resolution, remove animated head-bone camera anchoring, preserve consistent tracking space, synchronize frames and stabilize the world.
- [ ] Map controller grips and WebXR hand joints onto generic Mixamo arms/hands with calibrated inverse kinematics, missing-joint handling and pose restoration.
- [ ] Preserve instructions and menus with WebXR DOM overlays where supported and a clickable in-world UI fallback.
- [ ] Explore the actual Arcade editor and provide a working optional VR editing path using public editor integrations where available.
- [ ] Build a finite set of useful hackathon extras in isolated branches/worktrees, test them, and prepare merge instructions without merging or pushing.
- [ ] Produce accurate flowcharts, illustrations and hackathon-ready documentation aligned with https://about.tryarcade.com/hackathon.
- [ ] Complete main and optional-branch build/type/lint/tests, run browser validation, review deployment constraints and secrets, commit all intended changes, and confirm nothing was pushed.

## Validation boundaries

No Quest is available during implementation. Simulator tests validate math, frame sequencing, lifecycle, input mapping and UI integration, but do not prove headset comfort, GPU performance, hand tracking or device support. No proxy can guarantee unavailable, private, expired or broken upstream games will load. Browser user activation and consent rules remain authoritative.

## Delivery log

- Started from the private repository at `~/arcade-vr-proxy`, commit `889489e`.
- The current multiplayer gap is structural: the wrapper recognizes only `/play/<uuid>` and no WebSocket proxy exists.

- TypeScript migration: strict typecheck, lint, 20 integration/routing tests and production build pass. No Python application or extension is required.
