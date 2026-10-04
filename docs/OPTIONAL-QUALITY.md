# Adaptive resolution

The stereo render target uses one scale for both dimensions and both eyes. Sustained GPU-copy/render completion above 20 ms lowers the scale by 10%, with a 60% floor; sustained times below 10 ms restore 5% at a time. Changes require 20 samples and a five-second cooldown. UI stays at 1920 × 1080.

Merge `optional/adaptive-quality` to enable the policy. Tests cover sustained overload, cooldown, floor, recovery and invalid samples. Capture timing is a practical completion signal, not a hardware GPU timestamp. Quest profiling may justify different thresholds. Projection and FOV remain WebXR's values at every scale.
