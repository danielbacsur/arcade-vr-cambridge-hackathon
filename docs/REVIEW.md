# Integrated hackathon features

All five previously isolated feature branches are now merged into main, with a separate merge commit for each. The original worktrees remain under `~/arcade-vr-proxy-worktrees/` as historical feature snapshots; use `~/arcade-vr-proxy` for current development. Nothing has been pushed or deployed.

| Feature | Current behavior | Hardware review |
| --- | --- | --- |
| Comfort controls | 30-degree right-stick snap turns and movement vignette | Comfort and controller mapping |
| Adaptive quality | Bounded stereo resolution based on capture pressure | Actual Quest timing |
| Haptics/actions | Selection feedback, right-trigger E, left-grip crouch | Per-game key bindings and haptics support |
| Visible hands | Lightweight palms/finger lines with controller fallback | Visual scale and tracking |
| Spatial editor | Original editor on a world-space panel; pinch/select and native placement, pan/orbit and Undo | Hand-driven editing and proxy authentication |

## Hand-only movement and UI

The gameplay HUD follows the view, including pitch and roll. **Right-hand thumb/index pinch** selects buttons and holds/drag controls; a small cyan pointer shows its target. The added movement joystick and its label have been removed.

Hand movement gestures and the virtual joystick have been removed. Physical controllers and laptop controls retain movement. The laptop head preview shows one eye without the gameplay UI; drag it horizontally or vertically to look around.

This uses native WebXR hand poses with the existing Arcade player controller; it is application-defined locomotion rather than an automatic browser walking feature. No permanent movement overlay is needed. Controller movement still works when a controller is available.

## Laptop jury preview

The right pane renders two genuine offset player cameras into one side-by-side texture. Each eye has its own aspect-correct projection. The original engine HUD and cached DOM menu capture are composited onto both eye images, while the original live view remains on the left. Dragging the right pane still changes player look. This desktop preview is illustrative: its fixed eye separation and flat UI overlay are not a claim to reproduce the exact Quest optics or world-panel placement. Quest continues to use native eye projections and a view-following interactive HUD.

## Editor and deliberate limits

The editor source image remains monoscopic on a stereoscopic spatial panel. Native selection, placement, pointer transactions and Undo are preserved; this is not a volumetric scene editor. The optional original-origin Chrome extension builds with `npx tsx scripts/build-editor.ts`, but has not been installed. Its mechanism is not assumed to exist in Quest Browser.

Quest hardware validation is still pending. E/C actions are game conventions rather than a universal API; visible hands are local rendering without colliders or multiplayer replication. DOM capture can omit unsupported cross-origin content or CSS. Browser consent still uses the original game's trusted Start interaction.

Strict types, lint, production build and 72 tests pass after the hand-only HUD/recovery follow-up. A real browser GPU fixture verifies two desktop eye cameras with HUD in both eyes, native simulated-pose stereo capture, correct sRGB/alpha blending and renderer restoration. Actual headset comfort and performance are separate checks.

The laptop stereo pane also uses a lightweight SVG headset silhouette: mirrored irregular eye openings with soft black edges and a nose-side cutout. It is a presentation overlay, does not intercept drag controls, and is hidden in immersive mode. It does not simulate lens optics or alter Quest projections.

## Rendering recovery

A foreground capture stall of six seconds or a lost WebGL context exits XR, restores the game view and releases input. Tap the native game view to re-enter VR. Headset suspension does not count as a stall; resuming recalibrates tracking. Old asynchronous captures cannot alter a replacement renderer, and partial capture failures dispose successful bitmap allocations. Eye buffers use a uniform 960-pixel maximum dimension and the capture bridge is limited to 45 fps; native XR presentation and lens projections remain browser-controlled, while captures include a 35% tangent guard band. These changes address identified software failure paths, not a reproduced diagnosis of the reported Quest restart.

The aggressive low-resolution/foveation/shadow reductions have been reverted to the earlier quality settings. VR UI uses a fixed 1920 × 1080 document and matching GPU target, refreshes on entry and periodically, and retries failed initial snapshots. Browser resizing does not change the runtime UI viewport.
