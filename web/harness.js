const CHANNEL='arcade-vr-lab-v1',frame=document.querySelector('#frame'),target=document.querySelector('#target'),log=document.querySelector('#log'),sessions=document.querySelector('#session'),status=document.querySelector('#status');
const ORIGINS=new Set(['https://www.tryarcade.com','https://editor.joinarcade.ai','https://dashboard.joinarcade.ai','http://localhost:8765']);
const pending=new Map(),known=new Map();let cursor=0,timer=null;
function record(label,data){log.textContent=(label+'\n'+JSON.stringify(data,null,2)+'\n\n'+log.textContent).slice(0,40000);}
function register(d){
  if(!d.session)return;
  const before=known.has(d.session),info=d.result?.origin?d.result:known.get(d.session)||{};
  known.set(d.session,info);
  if(!before){const empty=!sessions.options.length;const o=document.createElement('option');o.value=d.session;o.textContent=(info.origin||d.url||'Adapter')+(info.path||'')+' '+d.session.slice(0,8);sessions.append(o);if(empty)sessions.value=d.session;}
}
function receive(d,transport){
  register(d);const p=pending.get(d.id);
  const elapsed=p?Math.round(performance.now()-p.start):null;
  if(p){clearTimeout(p.timeout);pending.delete(d.id);}
  status.textContent=transport+': '+(d.ok?'reply received':'command rejected')+(elapsed!==null?' in '+elapsed+' ms':'');
  status.className=d.ok?'good':'warn';record(transport+(elapsed!==null?' '+elapsed+' ms':''),d);
}
window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||!ORIGINS.has(e.origin)||e.data?.channel!==CHANNEL||e.data.direction!=='response')return;
  receive(e.data,'iframe postMessage');
});
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Lab-Token':LAB_CONFIG.token},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
async function send(op,payload){
  const id=crypto.randomUUID(),session=sessions.value,transport=document.querySelector('#transport').value;
  const command={channel:CHANNEL,direction:'request',id,op,payload,session:session||undefined};
  const timeout=setTimeout(()=>{pending.delete(id);status.className='warn';status.textContent='No reply within 4 seconds: missing adapter, wrong session, unavailable relay, or a blocked frame.';record('TIMEOUT',{id,op,transport});},4000);
  pending.set(id,{start:performance.now(),timeout});
  try {
    if(transport==='relay'){if(!session)throw Error('Select a connected session');await api('/api/command',{session,command});}
    else { // Try both editor and dashboard because the editor may redirect across origins.
      const origin=new URL(target.value,location.href).origin;
      if(!ORIGINS.has(origin))throw Error('Unsupported frame origin');
      frame.contentWindow.postMessage(command,origin);
      if(origin==='https://editor.joinarcade.ai')frame.contentWindow.postMessage(command,'https://dashboard.joinarcade.ai');
    }
  }catch(e){clearTimeout(timeout);pending.delete(id);record('ERROR',{message:e.message});}
}
function load(url){if(timer){clearInterval(timer);timer=null;document.querySelector('#stream').textContent='Start 5 Hz probe';}target.value=url;sessions.replaceChildren();known.clear();frame.src=url;document.querySelector('#frame-status').textContent='Loading '+url;}
frame.addEventListener('load',()=>{
  let result;try{result={sameOrigin:true,title:frame.contentWindow.document.title};}catch(e){result={sameOrigin:false,error:e.name,meaning:'Expected browser isolation: parent cannot access child DOM or engine globals'};}
  document.querySelector('#frame-status').textContent='Frame load event. '+(result.sameOrigin?'Parent can read this page served from our own origin.':'Cross-origin access blocked as expected.');record('Parent DOM access test',result);
});
document.querySelector('#load').onclick=()=>load(target.value);
document.querySelector('#fixture').onclick=()=>load(location.origin+'/fixture.html');
document.querySelector('#market').onclick=()=>load('https://www.tryarcade.com/');
document.querySelector('#dashboard').onclick=()=>load('https://dashboard.joinarcade.ai/');
document.querySelector('#proxy').onclick=()=>load(location.origin+'/play/db962afa-df0d-48ba-ab66-0290c2dd0e62');
document.querySelector('#popup').onclick=()=>window.open(target.value,'_blank','noopener');
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>send(b.dataset.op,b.dataset.op==='ping'?{hello:'from our app',sentAt:Date.now()}:undefined));
document.querySelector('#pose').onclick=()=>send('camera.pose',{position:{x:3,y:2,z:5},euler:{x:0,y:45,z:0}});
document.querySelector('#clear').onclick=()=>log.textContent='Cleared.';
document.querySelector('#stream').onclick=e=>{if(timer){clearInterval(timer);timer=null;e.target.textContent='Start 5 Hz probe';}else{timer=setInterval(()=>send('describe'),200);e.target.textContent='Stop probe';}};
async function poll(){try{const d=await api('/api/status?after='+cursor);for(const e of d.events){cursor=Math.max(cursor,e.seq);receive(e.event,'extension → middleware → app');}}catch(e){status.textContent='Relay unavailable: '+e.message;}setTimeout(poll,500);}
poll();
