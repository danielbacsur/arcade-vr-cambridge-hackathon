# Rendering quality

Quest again starts at native eye resolution, uniformly capped to 2048 pixels per eye dimension, with the original native-resolution XR framebuffer and original game shadows. Adaptive copy timing reduces scale by 10% after sustained cost above 20 ms, down to the earlier 60% floor, and restores 5% below 10 ms. Changes require 20 samples and a five-second cooldown. No forced foveation is applied. The aggressive 960-pixel/40%-scale/shadow downgrade has been removed.

The single-flight game capture path runs at up to 90 Hz. Stereo texture storage is reused, scene discovery stays cached, and capture cleanup remains bounded. The headset presents at its native clock and uses native lens projections. Extra capture coverage and the sky projection fix remain.

The Quest embed renders the frontend in a fixed 1920 × 1080 document, scaled to fill the browser window; XR eye resolution is independent. Its GPU HUD has the same dimensions, with an explicit initial resize/layout notification. DOM capture retries failure, refreshes periodically, and observes resume/resize. This prevents a stale initial capture and browser-window-dependent HUD layout. Laptop game and single-eye preview buffers remain capped at 1280 × 720; the head feed has no extra UI compositing.

Hand locomotion has been removed. Right-hand menu selection remains. Physical controller sticks and laptop controls drive movement. Actual Quest visual quality/performance still requires device verification.
