(() => {
  'use strict';
  if (location.hostname === 'www.tryarcade.com') return;
  if (['localhost','editor.localhost'].includes(location.hostname) && location.pathname !== '/fixture.html') return;
  if (window.__arcadeVRLab) return;
  const CHANNEL = 'arcade-vr-lab-v1';
  const PARENTS = new Set(['http://localhost:8765','http://127.0.0.1:8765','http://localhost','http://editor.localhost','http://editor.localhost:8765']);
  const trustedParent=origin=>{try{const u=new URL(origin),own=new URL(location.href);return PARENTS.has(origin)||(own.hostname.startsWith('runtime.')&&u.protocol===own.protocol&&u.port===own.port&&u.hostname===own.hostname.replace(/^runtime\./,'editor.'));}catch{return false;}};
  const session = crypto.randomUUID();
  let armed = false, savedCamera = null, savedTransform = null;
  const app = () => window.pcApp || window.gameManager?.getApp?.() || null;
  const camera = () => {
    const gm = window.gameManager;
    const candidate = gm?.getViewCamera?.() || gm?.getCamera?.();
    if (candidate?.entity && typeof candidate.entity.getPosition === 'function') return candidate.entity;
    if (candidate?.camera && typeof candidate.getPosition === 'function') return candidate;
    return app()?.root?.findComponents?.('camera')?.find(c => c.enabled && c.entity?.enabled)?.entity || null;
  };
  const xyz = v => v ? {x: v.x, y: v.y, z: v.z} : null;
  function snapshot() {
    const a = app(), c = camera();
    return {
      session, origin: location.origin, path: location.pathname,
      pc: !!window.pc, pcVersion: window.pc?.version || null, app: !!a,
      gameManager: !!window.gameManager, camera: c ? {name: c.name, position: xyz(c.getPosition()), euler: xyz(c.getEulerAngles())} : null,
      device: a?.graphicsDevice?.deviceType || null,
      webxrAPI: !!navigator.xr, webgpuXRBinding: typeof window.XRGPUBinding !== 'undefined',
      engineXR: !!a?.xr?.supported, vrAvailable: !!a?.xr?.isAvailable?.('immersive-vr'),
      canvasCount: document.querySelectorAll('canvas').length, armed,
      injectedInMainWorld: window.__arcadeVRLab?.session === session,
      fixture: location.pathname === '/fixture.html' && location.hostname === 'localhost'
    };
  }
  function restore() {
    if (savedCamera && savedTransform) {
      savedCamera.setPosition(savedTransform.position.x, savedTransform.position.y, savedTransform.position.z);
      savedCamera.setEulerAngles(savedTransform.euler.x, savedTransform.euler.y, savedTransform.euler.z);
    }
    savedCamera = null; savedTransform = null; armed = false;
    return snapshot();
  }
  async function execute(request, context) {
    switch (request.op) {
      case 'ping': return {echo: request.payload ?? null, mainWorld: true, session};
      case 'describe': return snapshot();
      case 'xr.check': return {...snapshot(), immersiveVR: navigator.xr ? await navigator.xr.isSessionSupported('immersive-vr') : false};
      case 'scene.snapshot': {
        const a = app();
        if (!a?.root) return {available: false, reason: 'No live world is loaded'};
        const entities = [], queue = [a.root];
        while (queue.length && entities.length < 1000) {
          const e = queue.shift();
          entities.push({id: e.getGuid?.() || null, name: e.name, parent: e.parent?.getGuid?.() || null, enabled: e.enabled, position: xyz(e.getPosition?.()), euler: xyz(e.getEulerAngles?.()), camera: !!e.camera, render: !!e.render, model: !!e.model});
          if (e.children) queue.push(...e.children);
        }
        return {available: true, entities, truncated: !!queue.length, note: 'Transforms only; this does not export meshes, materials, scripts or game state'};
      }
      case 'camera.pose': {
        if (!armed) throw new Error('Camera writes are not armed. Enable them in the injected panel.');
        const c = camera(); if (!c) throw new Error('No active camera');
        const p = request.payload?.position, r = request.payload?.euler;
        const valid = v => v && ['x','y','z'].every(k => Number.isFinite(v[k]) && Math.abs(v[k]) < 1e6);
        if (!valid(p) || !valid(r)) throw new Error('Expected finite position and euler vectors');
        if (!savedCamera) { savedCamera = c; savedTransform = {position: xyz(c.getPosition()), euler: xyz(c.getEulerAngles())}; }
        c.setPosition(p.x,p.y,p.z); c.setEulerAngles(r.x,r.y,r.z);
        return snapshot();
      }
      case 'camera.restore': return restore();
      default: if (window.__arcadeControls) return window.__arcadeControls.execute(request, context); throw new Error('Unsupported operation: ' + request.op);
    }
  }
  function emit(message, target = window, targetOrigin = location.origin) {
    target.postMessage({channel: CHANNEL, direction: 'response', session, ...message}, targetOrigin);
  }
  window.addEventListener('message', async event => {
    const d = event.data;
    if (!d || d.channel !== CHANNEL || d.direction !== 'request' || typeof d.id !== 'string' || d.id.length > 120) return;
    const self = event.source === window && event.origin === location.origin;
    const parent = event.source === window.parent && window.parent !== window && trustedParent(event.origin);
    if (!self && !parent) return;
    if (d.session && d.session !== session) return;
    try { emit({id:d.id, op:d.op, ok:true, result: await execute(d, {source:event.source,origin:event.origin})}, event.source, event.origin); }
    catch (error) { emit({id:d.id, op:d.op, ok:false, error:String(error.message || error)}, event.source, event.origin); }
  });
  const panel = document.createElement('aside');
  panel.id = 'arcade-vr-lab-panel';
  panel.style.cssText = 'position:fixed;right:12px;bottom:12px;width:350px;max-height:60vh;overflow:auto;z-index:2147483647;background:#101820;color:#e4edf3;padding:14px;border:1px solid #56b6c2;border-radius:10px;font:12px/1.45 monospace;box-shadow:0 8px 35px #0008';
  const heading = document.createElement('strong'); heading.textContent = 'Arcade VR Integration Lab';
  const buttons = document.createElement('div'); buttons.style.margin = '10px 0';
  const output = document.createElement('pre'); output.id = 'arcade-vr-lab-output'; output.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:0';
  function button(label, fn) { const b = document.createElement('button'); b.textContent = label; b.style.margin = '3px'; b.onclick = fn; buttons.append(b); }
  button('Refresh probe', () => output.textContent = JSON.stringify(snapshot(), null, 2));
  button('Ping bridge', () => window.postMessage({channel:CHANNEL,direction:'request',id:crypto.randomUUID(),op:'ping',payload:{source:'in-page-button'}}, location.origin));
  button('Arm camera writes', () => {armed = true; output.textContent = JSON.stringify(snapshot(),null,2);});
  button('Restore / disarm', () => {output.textContent = JSON.stringify(restore(),null,2);});
  button('Remove panel', () => {restore(); panel.remove();});
  panel.append(heading,buttons,output); document.body.append(panel);
  window.__arcadeVRLab = {session, snapshot, restore};
  output.textContent = JSON.stringify(snapshot(),null,2);
  window.addEventListener('message', e => {if (e.source===window && e.origin===location.origin && e.data?.channel===CHANNEL && e.data.direction==='response') output.textContent=JSON.stringify(e.data,null,2);});
  emit({id:'ready',op:'describe',ok:true,result:snapshot()});
  // This announcement reveals no tokens or user profile data. The parent still checks event.source.
  if (window.parent !== window) for (const origin of PARENTS) emit({id:'ready',op:'describe',ok:true,result:snapshot()}, window.parent, origin);
})();
