(() => {
  'use strict';
  const xrRequested=new URLSearchParams(location.search).get('xr')==='1';
  // Native game HUDs are DOM overlays. The game itself remains intact.
  const style=document.createElement('style');style.textContent='html,body{margin:0;background:#000!important}#arcade-vr-lab-panel{display:none!important}canvas{max-width:100%;max-height:100%}';document.head.append(style);
  if(!xrRequested||typeof XRGPUBinding==='undefined')return;
  const button=document.createElement('button');button.textContent='Enter VR';button.hidden=true;button.setAttribute('aria-label','Enter virtual reality');
  button.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#fff;color:#000;border:0;border-radius:6px;padding:14px 24px;font:600 16px system-ui;cursor:pointer';document.body.append(button);
  button.onclick=()=>{try{const a=window.pcApp||window.gameManager?.getApp?.();if(a?.xr?.active){a.xr.end();return;}window.__arcadeStartXR();}catch(error){button.textContent=error.message;}};
  setInterval(()=>{const a=window.pcApp||window.gameManager?.getApp?.();if(a?.xr?.isAvailable('immersive-vr')&&window.__arcadeControls?.ready?.()){button.hidden=!!a.xr.active;button.textContent='Enter VR';}},500);
})();
