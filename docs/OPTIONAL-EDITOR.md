# Spatial editor panel

This branch keeps Arcade's real editor, tools and undo history. Its existing viewport appears on a stereoscopic world-space panel; the source scene inside that panel is monoscopic. It is an editing interface, not a volumetric scene rewrite. Select or pinch places/selects through the native pointer path. Left squeeze pans, right squeeze rotates, and a held select drags a gizmo. The existing Build → Primitives → Box and Undo controls stay clickable.

Merge `optional/editor-tabletop` to enable the adapter on proxy editor project routes. Browser entry uses an existing editor interaction and respects consent. For an authenticated original editor, `npx tsx scripts/build-editor.ts` produces an optional unpacked Chrome extension in `dist/editor-extension`. It runs only on `editor.joinarcade.ai`, has no account-data collection, and retains original login. Installation is left for morning review; it has not been installed. This also avoids assuming Arcade accepts new OAuth redirect origins for a proxy domain.

Actual Chrome validation signed in, opened a new blank draft, placed a box with native input, and undid it. No AI prompt, save, or publication was submitted. Automated tests cover pointer ordering and button masks, while the shared browser fixture verifies panel targeting. No Quest is available, so hand-driven placement remains a hardware integration check.

The original scene is capped uniformly within 1920 × 1080 and captured at up to 30 fps. DOM menus retain the actual viewport layout and rasterize at up to 4 fps. Exit restores the native animation loop and render size. A future volumetric tabletop editor needs an explicit picking/placement API with undo transactions; it should not guess internal scene mutations.
