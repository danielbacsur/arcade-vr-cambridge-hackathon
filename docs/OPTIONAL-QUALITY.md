# Adaptive rendering quality

Quest starts at 80% of an eye buffer uniformly capped to 960 pixels on its longest side. Sustained render-and-copy completion above 20 ms lowers scale by 10%, down to 40%, with a one-second reduction cooldown. Completion below 10 ms restores 5% at a time, up to 80%, with a five-second recovery cooldown. Budgeting reads a cheap timing accessor rather than scanning the scene every headset frame.

The game ticks only when the single-flight capture bridge is free, at up to 45 Hz. The XR compositor presents and rotates the last captured frame at the headset's native rate. Captured lenses have 35% extra tangent coverage; presentation retains the headset's native lens projection. Edge clamping fills temporary uncovered pixels during unusually fast turns, with edge stretching rather than a black rectangular border. This cannot reconstruct unseen geometry or positional disocclusion.

Stereo uploads reuse the existing texture allocation. Quest uses a full-viewport browser embed, an 85% XR framebuffer scale, and 70% fixed foveation when the browser exposes it. XR shadow maps are capped to 512 pixels and restored on exit. Scene/rig discovery is cached between scans. Engine UI capture is 1280 × 720 at up to 4 Hz; DOM UI rasterization is bounded to 1280 × 720 at up to 2 Hz. Laptop render buffers never exceed 1280 × 720.

These limits substantially reduce the previous maximum pixel/copy workload. They are not an on-device FPS measurement: WebGPU-to-WebGL bitmap interop still has a cost, and heavy upstream game logic can exceed the budget. A native shared-GPU XR renderer remains the architectural route to removing that cost entirely.
