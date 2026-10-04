# Integrated hackathon features

All five previously isolated feature branches are now merged into main, with a separate merge commit for each. The original worktrees remain under `~/arcade-vr-proxy-worktrees/` as historical feature snapshots; use `~/arcade-vr-proxy` for current development. Nothing has been pushed or deployed.

| Feature | Current behavior | Hardware review |
| --- | --- | --- |
| Comfort controls | 30-degree right-stick snap turns and movement vignette | Comfort and controller mapping |
| Adaptive quality | Bounded stereo resolution based on capture pressure | Actual Quest timing |
| Haptics/actions | Selection feedback, right-trigger E, left-grip crouch | Per-game key bindings and haptics support |
| Visible hands | Lightweight palms/finger lines with controller fallback | Visual scale and tracking |
| Spatial editor | Original editor on a world-space panel; pinch/select and native placement, pan/orbit and Undo | Hand-driven editing and proxy authentication |

## Hand-only movement

Pinch the **left thumb and middle fingertip** together to grab a floating joystick at the current hand position. Move that hand forward/backward or left/right to move the player; release to stop. A 2 cm dead zone absorbs small tremors; 10 cm displacement reaches full speed. Missing or invalid tracking immediately stops and resets the anchor. Head translation is subtracted to reduce body sway. Axes are calibrated to the heading when the pinch begins; movement follows the player's current viewing direction as with the controller stick. Index pinch remains available for native UI selection.

## Laptop jury preview

The right pane renders two genuine offset player cameras into one side-by-side texture. Each eye has its own aspect-correct projection. The original engine HUD and cached DOM menu capture are composited onto both eye images, while the original live view remains on the left. Dragging the right pane still changes player look. This desktop preview is illustrative: its fixed eye separation and flat UI overlay are not a claim to reproduce the exact Quest optics or world-panel placement. Quest continues to use native eye projections and interactive spatial UI.

## Editor and deliberate limits

The editor source image remains monoscopic on a stereoscopic spatial panel. Native selection, placement, pointer transactions and Undo are preserved; this is not a volumetric scene editor. The optional original-origin Chrome extension builds with `npx tsx scripts/build-editor.ts`, but has not been installed. Its mechanism is not assumed to exist in Quest Browser.

Quest hardware validation is still pending. E/C actions are game conventions rather than a universal API; visible hands are local rendering without colliders or multiplayer replication. DOM capture can omit unsupported cross-origin content or CSS. Browser consent still uses the original game's trusted Start interaction.

Strict types, lint, production build and 63 tests pass after integration. A real browser GPU fixture verifies two desktop eye cameras with HUD in both eyes, native simulated-pose stereo capture, correct sRGB/alpha blending and renderer restoration. Actual headset comfort and performance are separate checks.

The laptop stereo pane also uses a lightweight SVG headset silhouette: mirrored irregular eye openings with soft black edges and a nose-side cutout. It is a presentation overlay, does not intercept drag controls, and is hidden in immersive mode. It does not simulate lens optics or alter Quest projections.
