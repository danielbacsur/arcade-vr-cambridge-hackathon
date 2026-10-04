# Morning review: five isolated optional features

Main contains the completed production adapter. These extras are implemented on separate local branches and worktrees, remain unmerged into main, and have not been pushed. The build discovers each branch's typed modules automatically. Select any subset; none requires another optional branch.

| Branch | Feature | Automated checks | Review focus |
| --- | --- | --- | --- |
| `optional/editor-tabletop` | Original editor on a spatial panel; pinch/select, native placement, left pan/right orbit and undo | Native pointer event ordering and button masks; extension bundle builds | Hand-driven editing and authentication on the intended headset browser |
| `optional/comfort-controls` | 30-degree snap turns and movement vignette | Deflection latch, release threshold, finite/bounded shading | Comfort, thumbstick mapping and preferred vignette strength |
| `optional/adaptive-quality` | Stereo resolution responds to capture pressure | Cooldown, floors/ceilings, recovery and invalid metrics | Actual Quest timing and the conservative thresholds |
| `optional/haptics-actions` | Short selection feedback, right-trigger E and left-grip crouch | UI priority, action release, pulse limits and missing API | Per-game key semantics and controller haptic support |
| `optional/visible-hands` | Lightweight palms and finger lines despite hidden own avatar | Missing joints, invalid positions and controller fallback | Visual scale and tracking confidence |

Worktrees are under `~/arcade-vr-proxy-worktrees/`, named `editor-tabletop`, `comfort-controls`, `adaptive-quality`, `haptics-actions` and `visible-hands`. Main remains at `~/arcade-vr-proxy`.

## Merge and rollback

Inspect a feature with:

```sh
cd ~/arcade-vr-proxy
git diff main...optional/comfort-controls
git log main..optional/comfort-controls
```

After approval, merge the selected branch and run the shared checks:

```sh
git merge --no-ff optional/comfort-controls
npm run check
```

Merge order is unrestricted. A temporary combined validation merge built all five features together without conflicts; 60 tests passed in the final combined check. Final checks are recorded in [the delivery record](TODO.md). No combined merge is present in main. Reverting the optional feature commit removes its module; rebuilding returns to the core behavior. Do not push until the review is complete.

## Editor details

The optional editor retains actual Arcade controls and transactions. Its scene appears on a stereoscopic world-space panel; the source editor image is monoscopic. It does not claim a volumetric tabletop scene or mutate undocumented editor internals. Select/pinch places or drags using native pointer events. Left squeeze pans with middle-button input; right squeeze rotates with right-button input. The original menus, Build → Primitives → Box and Undo remain clickable. Source editor rendering/capture is capped at about 30 fps; the panel is drawn on the native XR clock.

Chrome validation signed into Arcade with the authorized Google account, opened a new blank draft, placed one box and undid it. No AI prompt, save or publication was submitted. The blank draft may remain in the account. Hand-operated placement still needs the headset.

For the original authenticated editor, the branch builds an optional MV3 Chrome extension:

```sh
cd ~/arcade-vr-proxy-worktrees/editor-tabletop
npx tsx scripts/build-editor.ts
```

The resulting `dist/editor-extension` runs only on `https://editor.joinarcade.ai/*`, retains original login and requires no account-data collection. It has not been installed. Installation is a separate review action, and Chrome's extension mechanism is not assumed to exist in Quest Browser. The proxy editor path is the headset option when authentication is available on that origin.

## Deliberate limits

All five extras have implementation and test coverage, but no overnight Quest test. Controller bindings E/C are common conventions, not a universal game action API. Visible hands are rendering proxies, not colliders or multiplayer replication. Adaptive quality uses capture completion time rather than GPU timestamp queries. The editor uses the supported interaction path; volumetric editing would need a stable picking/undo API from Arcade.
