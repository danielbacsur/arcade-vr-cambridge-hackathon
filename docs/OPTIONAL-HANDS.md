# Visible tracked hands

A lightweight palm and finger-line proxy makes tracked input visible while the original avatar body remains hidden from its own camera. Positions share the calibrated game scale. Hand tracking draws available finger chains; controllers show a palm/grip marker. Original Mixamo bone mapping still runs.

Merge `optional/visible-hands`. The proxy uses two small entities per hand, no colliders and no shadows. Missing tracking hides the marker; session exit disposes meshes and materials. Tests reject invalid joint vertices and do not invent fingers for controller-only input. Appearance and occlusion need Quest review. These markers are local and are not multiplayer hand replication.
