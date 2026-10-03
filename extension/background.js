let configuration;
async function config() {return configuration ||= fetch(chrome.runtime.getURL('config.json')).then(r=>r.json());}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (!sender.tab || !sender.url) return false;
  const url = new URL(sender.url);
  const valid = ['www.tryarcade.com','editor.joinarcade.ai','dashboard.joinarcade.ai'].includes(url.hostname) && url.protocol==='https:' || url.origin==='http://localhost:8765' && url.pathname==='/fixture.html';
  if (!valid || !['event','poll'].includes(message.kind)) return false;
  (async()=>{
    const c=await config();
    const path=message.kind==='event'?'/api/event':'/api/poll';
    const body=message.kind==='event'?{event:message.event}:{session:message.session};
    const r=await fetch(c.relay+path,{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Token':c.token},body:JSON.stringify(body)});
    if(!r.ok) throw new Error('Relay HTTP '+r.status);
    return r.json();
  })().then(reply).catch(e=>reply({error:e.message}));
  return true;
});
