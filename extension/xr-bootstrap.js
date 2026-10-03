(() => {
  'use strict';
  // Arcade requires WebGPU. Never remove navigator.gpu to select an XR backend.
  if(new URLSearchParams(location.search).get('xr')==='1')
    window.__arcadeXRBackend=typeof XRGPUBinding==='undefined'?'webgpu-bridge':'webgpu-native';
})();
