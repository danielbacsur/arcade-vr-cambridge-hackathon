# Comfort controls

Right thumbstick deflection turns the virtual heading by 30 degrees once, then requires a return to center. Physical head rotation remains direct. A bounded edge vignette appears only during virtual movement. UI stays unobstructed because it is drawn after the scene mask.

Merge `optional/comfort-controls` to enable this policy. Tests verify debounce, direction and mask bounds. The feature needs Quest comfort testing; teleportation is intentionally absent because generic game collision, goals and multiplayer authority do not expose a safe universal teleport contract.
