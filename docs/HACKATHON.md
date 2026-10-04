# Arcade VR — hackathon project brief

**Turn AI-created browser games into embodied VR experiences through an adapter around their existing runtime.** Keep the original game, controls and menus; replace the viewing and input layer with headset poses, stereo cameras and tracked hands.

The recommended submission is the **Game Tech Track**: this is a runtime integration and developer tool built around AI-native games. The organizer permits one track per project. Submissions need a project link and demo video by **Sunday 4 October 2026, 14:00 BST**. This brief is prepared locally; no submission or publication has been made. [Official hackathon page](https://about.tryarcade.com/hackathon), checked 4 October.

## Problem and solution

Arcade makes creating 3D games accessible, but ordinary camera controls, flat UI and animated avatar heads do not automatically become comfortable VR. A generated game may work on desktop while its assets, multiplayer routes or camera assumptions fail on a headset.

Our adapter preserves Arcade's URL paths, published game assets and original engine. A TypeScript proxy handles routing and network compatibility. The same game scene receives two native eye projections, stable root-based tracking, direct avatar look and Mixamo hand IK. Original instructions and buttons stay available through browser overlays or a clickable world panel. Desktop automatically shows a split preview for development.

AI × Gaming relevance comes from making AI-authored games usable with embodied input, without asking every creator to rebuild a separate VR version. The adapter itself does not claim to add a new AI model or generate the demonstrated game.

## Implemented evidence

| Claim | Evidence and scope |
| --- | --- |
| TypeScript-only production application | Strict types, lint, tests and browser/server build; Python removed |
| Broad network compatibility | 121 public games; 352 bootstrap/asset checks; zero proxy discrepancies |
| Live desktop integration | Six Seven and Purrbound Island load and start; outside joystick changes player position; drag controls head direction |
| Multiple game routes | `/play/<uuid>` and `/mp`; expired room recovers to a fresh server |
| Stereo and menu compositor | Real GPU stereo disparity, sRGB and translucent HUD checks pass; a world-panel ray clicks the original DOM button |
| Stable tracking and hands | Automated projection, calibration, real PlayCanvas rig IK and pose-restoration checks |
| Optional integrations | Five independent branches plus a conflict-free combined build/test merge |
| Actual editor exploration | Native Box placement and Undo confirmed in a blank draft; optional spatial editor adapter prepared |

There was no Quest available overnight. Stereo correctness on-device, steady-state frame rate, hand accuracy and comfort are **not yet hardware-validated**. The illustration below is conceptual; the desktop capture is actual output.

![Conceptual runtime conversion](assets/vr-runtime-cutaway.png)

![Actual Six Seven desktop split preview](assets/desktop-player.jpg)

## Two-minute demo sequence

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:20 | Original marketplace and unchanged game path on the proxy | The game and its frontend are preserved |
| 0:20–0:45 | Six Seven split preview; outside joystick and head drag | The same live character responds; the own body is hidden in head view |
| 0:45–1:10 | Headset, if available: native Start → browser consent → gameplay | Native eye projection, root anchor, original menus and tracked hands |
| 1:10–1:30 | Compatibility report and architecture flow | Assets and multiplayer use a fixed-host transport bridge; VR frames remain local |
| 1:30–1:50 | One selected optional branch, preferably editor or visible hands | Extensions are isolated and reviewable |
| 1:50–2:00 | Validation table and the remaining device boundary | Distinguish demonstrated behavior from simulated/hardware-unverified behavior |

If the headset is unavailable, use desktop interaction and the shader/UI fixture as the demo. Do not represent simulated math or a conceptual illustration as recorded Quest gameplay. The fixture runs with `npx tsx scripts/browser-fixture.ts` at `http://127.0.0.1:8766`.

## Judging fit

The official criteria weight innovation 20%, execution 25%, AI × Gaming relevance 15%, track fit 25%, impact 10% and demo clarity 5%. Prioritize a working interaction and a clear architecture over presentation decoration. [Judging criteria](https://about.tryarcade.com/hackathon#judging).

The innovation is an integration layer for existing AI-created games; execution evidence is the typed runtime, transport checks and live input; track fit is game technology and spatial editing; impact is a shared path for creators to explore VR. Claims should stay within the evidence above. There is no universal all-games guarantee: private content, deleted assets and unavailable servers cannot be repaired by an adapter.

## Submission-ready description

Arcade VR is a TypeScript runtime adapter that brings existing Arcade games into headset VR. It preserves game URLs, assets and menus while adding stereo eye cameras, stable head-relative movement, direct avatar look and tracked-hand rig mapping. Desktop automatically provides a split preview. A public catalog sweep covered 121 games and 352 transport/asset checks with no proxy discrepancies; live desktop controls and clickable UI were verified. Optional branches add a spatial editor panel, comfort controls, adaptive resolution, haptics and visible hands. Quest performance and comfort still require device validation.

## Supporting documents

- [Architecture and four flowcharts](ARCHITECTURE.md)
- [Compatibility evidence and reproduction](COMPATIBILITY.md)
- [Deployment and authentication boundaries](DEPLOYMENT.md)
- [Optional feature review and merge instructions](REVIEW.md)
- [Completed delivery record](TODO.md)
