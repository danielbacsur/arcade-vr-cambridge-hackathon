# Arcade VR integration options

Research and experiments for the Arcade hackathon, 3 October 2026.

We can inject a small adapter into Arcade and exchange real engine data with our own application. A working Chrome extension read the live PlayCanvas application, camera, and 473 scene entities in the public Tidy Library game. It also changed and restored the camera. Arcade embeds inside our page, but an unmodified cross-origin iframe does not give our app engine access. A partial proxy can inject without an extension, but moving the player to localhost breaks backend origin checks.

My recommendation is to retain Arcade's origin and use the injected adapter for the first prototype. Test native WebXR rendering in Arcade first. If its WebGPU XR backend cannot run on the target Quest, choose between a scene mirror rendered locally on Quest and a desktop streaming approach. A full reverse proxy is a separate deployment experiment, not a prerequisite for data exchange.

## Verified results

| Experiment | Result | Scope |
| --- | --- | --- |
| Manifest V3 extension injection | Passed | Actual Chrome extension, MAIN and isolated execution worlds |
| Unmodified iframe embedding | Passed | Dashboard visibly rendered inside our localhost page |
| Direct access to original iframe DOM | Blocked with SecurityError | Expected same-origin policy; CORS headers on a page do not grant DOM access |
| Our protocol in the unmodified iframe | No reply within 4 seconds | Does not prove that Arcade has no other messaging APIs |
| Injected Arcade iframe ping | Passed, one sample 1 ms | Dashboard; small local message, not a sustained performance benchmark |
| Local fixture camera write and restore | Passed | Initial pose restored; unarmed writes rejected |
| Middleware command round trip | Passed, one fixture sample 710 ms | Extension MAIN → isolated → background → local server → our app |
| Separate browser application reading Arcade | Passed | Our in-app-browser harness controlled Arcade in Chrome through the relay |
| Live public player access | Passed | Tidy Library public player; no account login or account token extraction |
| Live scene transforms | Passed | 473 entities, no truncation; geometry and behavior not exported |
| Live camera write | Passed | `PlayCamera:fps` immediately reflected position 3,2,5 and yaw 45 degrees |
| Camera restoration | Passed | Original pose restored after the menu-state test; writes disarmed at cleanup |
| Sustained camera ownership in active play | Not achieved | A later fresh sample reverted to the player camera's normal pose |
| Live XR availability on desktop | Unavailable | WebGPU renderer, XR manager present, no XRGPUBinding or available immersive session on this device |
| Proxy injection without an extension | Passed | In-app browser; parent and child shared localhost origin; ping sample 4 ms |
| Proxied game loading | Failed | Backend fetch blocked at the new origin; additional asset path coverage needed |
| Quest headset VR session | Untested | No connected headset was available in this experiment |

These latency samples include browser scheduling and the prototype's polling. They are not headset motion-to-photon measurements.

## What the adapter can access

The public player exposes `window.pc`, `window.pcApp`, and `window.gameManager`. We verified PlayCanvas version 2.22.0 at runtime. `gameManager.getViewCamera()` gives the active camera; `getCamera()` and `getApp()` provide fallback access. These are implementation details rather than a documented stable Arcade API. [Current public runtime bundle](https://editor.joinarcade.ai/static/js/8790.20aeff2c.chunk.js).

The player creates additional frames, including `/blitz-panel/index.html`, during play. Those frames have separate adapters and sessions. A command must target the game frame. The harness now preserves the selected session when another frame announces itself.

We can currently move small serializable objects in and out: camera poses, entity transforms, IDs, capability flags, commands, and acknowledgments. A PlayCanvas application object, GPU context, or DOM frame is not a scene format that our other renderer can consume. A scene mirror needs actual mesh/material/texture data plus ongoing state updates. A screenshot or canvas stream provides pixels, not a navigable 3D world.

## Option 1 WebXR directly inside Arcade

**Plan:** Inject an Enter VR button into the original public player. Create a dedicated XR camera under a rig tied to the player's location, or temporarily take over the existing camera controller. Start PlayCanvas's XR manager from a user click. Preserve Arcade's simulation, AI, physics, assets, and multiplayer while WebXR provides headset poses and stereo eye views. Restore camera state and controllers on exit.

**Data path:** Quest pose and controller events → injected adapter → existing Arcade runtime. Rendering stays on the headset. A server is optional for logging, pairing, or AI commands.

**Why prioritize it:** It keeps a single authoritative world and avoids copying geometry or sending video. PlayCanvas already supports XR camera integration. [PlayCanvas XR lifecycle](https://developer.playcanvas.com/user-manual/xr/using-webxr/).

**First experiment:** On the actual Quest, record `navigator.xr.isSessionSupported('immersive-vr')`, `XRGPUBinding`, the graphics backend, and `app.xr.isAvailable('immersive-vr')`. Then start a session before adding movement or interactions.

**Main risks:** WebGPU XR compatibility; the normal camera controller overwriting poses; custom shaders or screen-space effects failing in stereo; frame rate and memory limits; ordinary HTML menus requiring a VR interaction design. Two manually offset cameras do not by themselves provide headset presentation, lens handling, or correct tracked eye projections.

**Status:** Engine access verified; VR start and camera ownership work remain.

## Option 2 Chrome extension with desktop PCVR

**Plan:** Package the same adapter as an extension in the desktop browser hosting Arcade. Use a browser/OS/VR-runtime combination that exposes the Quest as a WebXR headset through a PCVR connection. The extension adds XR and controller integration to the existing game.

**Data path:** Headset → desktop XR runtime → browser → Arcade adapter. The headset connection supplies rendering transport rather than a custom web relay.

**First experiment:** Validate a known WebXR sample on that exact desktop and headset connection, then test Arcade. This Mac experiment does not establish PCVR support on the user's machine.

**Main risks:** Hardware and OS setup, browser headset support, and the same camera/rendering issues as Option 1. Do not assume Quest Browser can install the desktop Chrome extension; that distribution path has not been verified.

**Status:** Extension injection verified; desktop headset connection untested.

## Option 3 Our web shell around an original Arcade iframe

**Plan:** Host our own page with pairing controls, instructions, AI UI, and an Arcade iframe. Inject the adapter into the child through an extension, a development console, or an Arcade-supported script hook. Exchange a narrow command protocol with `postMessage`, later upgrading to MessageChannel for dedicated traffic.

**Data path:** Shell ↔ adapter inside child ↔ Arcade. Origin and window-source checks are required. Request IDs correlate responses; session IDs identify frames. We have this working for the dashboard with extension injection.

**First experiment:** Embed the public player URL rather than the editor root and verify the game reaches active play. Then test XR initiation from a user interaction inside the frame with delegated `xr-spatial-tracking` permission.

**Main risks:** Authentication in third-party frames, future frame-ancestors policies, nested frames, and XR permissions. The parent cannot directly read a cross-origin child's camera, canvas, or globals. Its iframe also does not automatically become a 3D object inside a separate WebXR scene. For immersive play, XR rendering must occur in the child or a separate rendering architecture must supply the visuals.

**Status:** Embedding and injected messages verified; immersive iframe player path untested. [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## Option 4 Original Arcade tab with a middleware server

**Plan:** Keep Arcade open in its original tab. The extension sends approved data to our middleware, which pairs a headset application or dashboard with a specific session and routes commands back. Use WebSocket for continuous updates; the supplied HTTP polling server is only a proof of connectivity.

**Data path:** Arcade MAIN adapter ↔ extension isolated bridge ↔ background/transport ↔ middleware ↔ our app. Arcade keeps its existing login and origin. The middleware need not reverse-proxy Arcade.

**First experiment:** Replace polling with a timestamped WebSocket protocol, measure round-trip time and disconnect behavior, and stream camera/player transforms at 20–30 Hz. Keep tracking at the local headset render rate rather than waiting for a server reply.

**Main risks:** Extension background lifecycle, CSP and network access when attempting connections from the page, server pairing and session routing, queue growth, and network latency. A Quest cannot access the desktop's localhost through Wi-Fi; use a reachable HTTPS/WSS service or an appropriate USB development route. The lab binds only to loopback.

**Status:** Real cross-tab and cross-browser commands/data verified. This is the recommended transport when our VR app is separate, regardless of whether that app uses Three.js, PlayCanvas, Babylon.js, Unity, or another engine.

## Option 5 A WebRTC connection to our headset app

**Plan:** Use middleware for signaling and pairing, then carry time-sensitive data over RTCDataChannel. Use a reliable channel for actions and asset manifests and an unordered channel with limited retransmission for pose/state updates. Add sequence numbers and drop stale updates.

**Data path:** Original Arcade adapter ↔ WebRTC peer ↔ Quest app. A signaling server remains; TURN may be needed on restrictive networks.

**First experiment:** Establish a two-device data-channel echo, record p50/p95 RTT and bufferedAmount, then forward a bounded set of entity transforms. Test reconnection.

**Main risks:** Network configuration, TURN deployment, and buffer/latency management. WebRTC is a transport; it does not create a stereo renderer or provide scene geometry. [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel).

**Status:** Proposed; not implemented in this lab.

## Option 6 Our own VR renderer mirroring Arcade

**Plan:** Arcade remains authoritative for AI and gameplay while our Quest application renders the world locally. Export a manifest of meshes, materials, textures, transforms, entity IDs, and coordinate conventions. Load those assets in our renderer. Send only state deltas during play and send interactions back as semantic actions.

**Data path:** Arcade → asset manifest and initial state → Quest renderer; Arcade ↔ state/actions ↔ Quest. Headset pose, stereo rendering, controller models, and local prediction stay in the Quest application.

**First experiment:** Mirror a small scene with a floor, one static object, and one moving object. Check world scale, hierarchy, animation, and IDs before attempting the entire world. Confirm a controller action changes the authoritative Arcade object.

**Main risks:** Export access and permissions, converting Arcade's custom materials/shaders, asset URL expiry, skinned meshes, terrain, VFX, and synchronization. Our 473-entity snapshot is only a transform graph; it cannot render the library in another engine. Independently simulating Arcade's physics would create conflicting authority unless carefully designed.

**Status:** Transform access verified; geometry/material export and action adapters untested. This is the strongest alternative if Arcade's WebGPU XR cannot run on Quest.

## Option 7 Stream Arcade onto a screen in VR

**Plan:** Capture the game's canvas or browser tab, send video/audio through WebRTC, and display it on a virtual screen in our Quest app. Relay gamepad or semantic input back to Arcade.

**Data path:** Arcade pixels/audio → video stream → headset screen; headset input → Arcade adapter.

**First experiment:** Capture the relevant canvas or use a user-initiated tab capture, stream to another browser, then display that video in a simple WebXR scene. Check whether WebGPU canvas capture works in the target browser and whether the canvas is origin-clean.

**Main risks:** Encoding latency, audio routing, capture permissions, and bandwidth. This produces a screen in VR, not immersive stereo with six-degree-of-freedom world navigation. It is a useful fallback demo. [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), [Chrome tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).

**Status:** Proposed; capture and streaming untested.

## Option 8 Stream two eye views from Arcade

**Plan:** Render two eye views in the desktop engine, encode a stereo stream, and present it in our Quest app. Feed headset pose upstream and apply pose prediction and an appropriate presentation strategy.

**First experiment:** Produce a side-by-side stereo render locally with a fixed camera pair. Validate stereo depth before connecting live head pose or video.

**Main risks:** Render scheduling, custom effects, encode/decode delay, synchronized eye projections, and motion-to-photon latency. A basic side-by-side video lacks the depth and timing information needed for a robust general-purpose reprojection solution. Arbitrary head translation also exposes geometry outside the rendered views. This is much harder than Option 7.

**Status:** Proposed; high effort and high risk for the first hackathon demo.

## Option 9 Full proxy with bundle rewriting

**Plan:** Serve Arcade's player and assets under our own origin, inject the adapter, and route approved public API traffic through a fixed upstream gateway. Rewrite hardcoded REST and WebSocket endpoints, relative asset paths, redirects, and browser-origin assumptions. Keep private account flows separate unless Arcade supplies a supported integration.

**What we tested:** The proxy served the public player and injected the bridge in a browser without the extension. The parent could read the child's DOM, and ping succeeded. Game loading failed because backend responses did not allow localhost. A direct public API request returned HTTP 200 with no CORS allowance for localhost; the original editor origin received the expected CORS header.

**First next experiment:** Proxy only the public play endpoint and rewrite only its public API base. Verify all GET assets load before enabling gameplay. Then inventory any mutations or multiplayer connections the player needs. The current server does not forward API traffic or account credentials.

**Main risks:** OAuth redirects, storage origins, third-party cookies, signed URLs, generated worker URLs, service workers, compression/caching, and production updates changing bundle contents. Removing a frame header alone would not solve these issues. Public demo success would not establish compatibility with authenticated editing. The current proxy preserves upstream security headers.

**Status:** Injection passed; complete game loading failed. This is lower priority than an original-origin adapter because the extension already avoids the origin migration.

## Option 10 Arcade supported script or SDK

**Plan:** Ask Arcade engineers at the hackathon for a runtime plugin hook, custom script component, camera ownership interface, and scene export format. Load our XR adapter as an officially supported game script or feature flag. Keep transport as in Option 4 if our app is separate.

**First experiment:** Obtain a minimal public game with an allowed custom script that exposes one camera and one game action. Run the same probe through that script on Quest.

**Main risks:** Availability and scope of supported hooks. This would greatly simplify headset delivery because no browser extension or origin rewriting is required.

**Status:** Proposed; no supported SDK was established during this research.

## Option 11 Export a world and run it independently

**Plan:** Obtain an authorized scene export or asset package and use Arcade as an authoring tool. Build the VR runtime ourselves, with our own physics, interactions, and optional AI backend.

**First experiment:** Export one small world to a known interchange format and reconstruct it in a headset-ready renderer. Preserve editable IDs so later authoring changes can be reapplied.

**Main risks:** Export support and asset rights, behavior portability, and losing Arcade's live AI, multiplayer, and game state. This is simpler than a continuously synchronized mirror when a standalone experience is acceptable.

**Status:** Proposed; export access and format unknown.

## Option 12 Browser remote debugging as a development bridge

**Plan:** Load the original public player on Quest and inject the adapter through Chrome DevTools connected by USB. Use this to test runtime access and XR before deciding the final delivery mechanism. An ADB/CDP helper could automate reinjection for development, but it is not a normal user installation path.

**First experiment:** Connect the headset, inspect the public player's tab, inject the adapter, and start an immersive session through a visible button. Meta documents the USB remote-debugging workflow. [Meta remote debugging](https://developers.meta.com/vr/documentation/web/browser-remote-debugging/).

**Main risks:** Developer setup, reinjection on navigation, and having to connect a device. This path avoids assuming that Quest supports desktop Chrome extensions.

**Status:** Proposed; headset not connected in this experiment.

## Recommended development sequence

1. Use the proven extension/adapter to inspect the team's own public game. Keep engine-frame session selection explicit.
2. On Quest, test XR backend compatibility before building networking or a stereo transport.
3. If native XR works, create a dedicated XR rig and stop conflicting camera updates. Keep the existing game authoritative and add one controller action.
4. If native XR fails, try a small scene mirror with local headset rendering. Use the proven relay for initial development, then WebSocket or WebRTC for deltas.
5. Keep a virtual-screen streaming demo as a fallback if asset extraction is too expensive.
6. Invest in full proxying only if an extension-free hosted wrapper is a hard requirement and a supported script hook is unavailable.

## Protocol for a separate VR application

Use a versioned handshake containing capabilities, game/session identifiers, selected frame, units, axis convention, and render mode. Keep a reliable command channel for interactions and a latest-state channel for pose/entity updates. Pose packets should include a sequence, timestamp, player ID, position in meters, normalized orientation quaternion, and controller button/axis state. Avoid broadcasting account data or arbitrary storage.

Give each scene entity a stable ID, parent ID, asset reference, and version. Send assets once, then changes to transforms, visibility, animation, and removals. Prefer semantic commands such as interact(entityId) or movePlayer over arbitrary JavaScript execution. Route authoritative actions through Arcade's game systems; synthetic keyboard events can fail because they are untrusted events or because the game consumes another input abstraction.

Define camera ownership explicitly. Use the player root as the locomotion reference and apply headset tracking locally. Restore ordinary camera behavior on XR exit. A periodic network camera write cannot substitute for integrating with the render loop; the experiment demonstrated that Arcade's active camera controller continues to update its pose.

The middleware should handle pairing, signaling, capability discovery, asset manifests, logs, and reconnection. The headset renderer should handle its own tracking, stereo views, and render timing. A native Unity/OpenXR app can use the same state/action protocol, but it requires the same asset/state boundary as a web renderer.

## Remaining unknowns

Quest's actual WebGPU XR bridge and performance; an Arcade-supported extension point; reversible ownership of the camera and player controllers; export of terrain and custom material data; controller interaction hooks; authoritative multiplayer integration; and the team's preferred public game. None of the experiments established end-to-end VR play.
