(() => {
  if (location.hostname === 'localhost' && location.pathname !== '/fixture.html') return;
  const CHANNEL = 'arcade-vr-lab-v1';
  let session = null, alive = true, busy = false;
  const send = data => chrome.runtime.sendMessage(data).catch(() => null);
  function request(op, payload) {window.postMessage({channel:CHANNEL,direction:'request',id:crypto.randomUUID(),op,payload},location.origin);}
  window.addEventListener('message', e => {
    if (e.source !== window || e.origin !== location.origin || e.data?.channel !== CHANNEL || e.data.direction !== 'response') return;
    session = e.data.session;
    // Explicit allowlist. Do not forward arbitrary site messages, credentials or storage.
    const d = e.data;
    if (!['ping','describe','xr.check','scene.snapshot','camera.pose','camera.restore'].includes(d.op)) return;
    send({kind:'event', event:{...d, transport:'extension-relay', isolatedWorld:true, url:location.origin+location.pathname}});
  });
  const timer = setInterval(async () => {
    if (!alive || busy || !session) return;
    busy = true;
    try {
      const response = await send({kind:'poll',session});
      for (const command of response?.commands || []) window.postMessage({...command,channel:CHANNEL,direction:'request',session},location.origin);
    } finally {busy=false;}
  },1000);
  window.addEventListener('pagehide',()=>{alive=false;clearInterval(timer);});
  request('describe');
})();
