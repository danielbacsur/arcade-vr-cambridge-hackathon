# Haptics and actions

Successful controller selection gives a short, bounded haptic pulse when the device exposes an actuator. API failures are contained. A right-controller selection that misses the UI sends an 80 ms `E` interaction pulse to the original game; UI clicks take priority. Left squeeze holds crouch. Existing jump/sprint buttons remain intact.

Merge `optional/haptics-actions`. Tests cover UI priority, key release, absent haptics, pulse limits and burst throttling. `E`/`C` are Arcade's common bindings, not a universal contract for every generated game. Headset/controller profiles and sensations need hardware review.
