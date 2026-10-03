'use strict';
let ORIGIN=null,immersiveAvailable=false,connecting=false,modeReady=false;
const CHANNEL='arcade-vr-lab-v1',frame=document.querySelector('#arena'),diag=document.querySelector('#diagnostics'),pending=new Map(),view=document.querySelector('#view'),context=view.getContext('2d',{alpha:false,colorSpace:'srgb'});
let session=null,connected=false,received=0,startFrames=0,startTime=0,lastFrame=0,move={x:0,z:0},held=new Set(),yaw=0,pitch=0,stickPointer=null,latest=null,gamepadName=null,lookPointer=null,lookLast=null;
let videoError=null,frameTimes=[];
let receiver=null,receiverCandidates=[],video=document.createElement('video'),videoCallback=null,lastUI=0;
video.muted=true;video.autoplay=true;video.playsInline=true;
function renderSettings(){return{debug:!immersiveAvailable,quality:immersiveAvailable?'sharp':document.querySelector('#quality').value,transport:immersiveAvailable?'direct':document.querySelector('#transport').value,tone:document.querySelector('#tone').value,exposure:Number(document.querySelector('#exposure').value)};}
function signal(payload){request('controls.rtc',payload).catch(e=>{videoError=e.message;document.querySelector('#feed-state').textContent='Video: '+videoError;});}
function closeVideo(){receiver?.close();receiver=null;receiverCandidates=[];if(videoCallback!==null)video.cancelVideoFrameCallback(videoCallback);videoCallback=null;video.srcObject=null;}
function presented(width,height){received++;lastFrame=performance.now();frameTimes.push(lastFrame);frameTimes=frameTimes.filter(t=>t>=lastFrame-2000);view.dataset.frames=String(received);if(lastFrame-lastUI>250){lastUI=lastFrame;const elapsed=(lastFrame-frameTimes[0])/1000;document.querySelector('#feed-state').textContent=`Live · ${Math.round((frameTimes.length-1)/Math.max(.001,elapsed))} fps · ${width} × ${height} scene · 1080p layout`;}}
async function acceptVideo(sdp){
  const queued=receiverCandidates;closeVideo();receiverCandidates=queued;const pc=receiver=new RTCPeerConnection({iceServers:[]});
  pc.onicecandidate=e=>{if(e.candidate)signal({candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{video.srcObject=e.streams[0];video.play().catch(error=>{document.querySelector('#feed-state').textContent=error.message;});const draw=()=>{if(receiver!==pc)return;if(video.readyState>=2){if(view.width!==video.videoWidth||view.height!==video.videoHeight){view.width=video.videoWidth;view.height=video.videoHeight;}context.drawImage(video,0,0);presented(view.width,view.height);}videoCallback=video.requestVideoFrameCallback(draw);};videoCallback=video.requestVideoFrameCallback(draw);};
  await pc.setRemoteDescription(sdp);for(const candidate of receiverCandidates)await pc.addIceCandidate(candidate);receiverCandidates=[];
  await pc.setLocalDescription(await pc.createAnswer());signal({sdp:pc.localDescription.toJSON()});
}
function request(op,payload){return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('No reply from game adapter: '+op));},5000);pending.set(id,{resolve,reject,timer});frame.contentWindow.postMessage({channel:CHANNEL,direction:'request',id,op,payload,session:session||undefined},ORIGIN);});}
function sendInput(){if(!connected||xrBridge.active||xrBridge.starting)return;frame.contentWindow.postMessage({channel:CHANNEL,direction:'request',id:'input-'+performance.now(),op:'controls.input',session,payload:{...move,keys:[...held]}},ORIGIN);}
function showState(s){latest=s;xrButton.hidden=!immersiveAvailable||typeof XRGPUBinding!=='undefined'||!s.gameReady||xrBridge.active||xrBridge.starting;if(s.look&&lookPointer===null){yaw=s.look.yaw;pitch=s.look.pitch;document.querySelector('#yaw').value=String(yaw);document.querySelector('#pitch').value=String(pitch);}const p=s.player?.position,c=s.camera?.position;document.querySelector('#telemetry').textContent=p?`Player: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\nHead camera: ${c?.x.toFixed(2)}, ${c?.y.toFixed(2)}, ${c?.z.toFixed(2)}\nLook: ${s.look?.yaw.toFixed(1)}° yaw, ${s.look?.pitch.toFixed(1)}° pitch${gamepadName?'\nGamepad: '+gamepadName:''}`:'Waiting for player';}
window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||e.origin!==ORIGIN||e.data?.channel!==CHANNEL)return;
  const d=e.data;
  if(d.direction==='response'){
    if(d.session)session=d.session;
    const p=pending.get(d.id);if(p){clearTimeout(p.timer);pending.delete(d.id);d.ok?p.resolve(d.result):p.reject(Error(d.error));}
  }else if(d.direction==='stream'&&d.session===session){
    if(d.type==='error'){document.querySelector('#feed-state').textContent='Camera error: '+d.error;return;}
    if(d.type==='state'){connected=d.state.connected;showState(d.state);if(d.state.performance?.transport==='direct')document.querySelector('#feed-state').textContent=`Direct · ${Math.round(d.state.performance.renderFPS)} fps · ${d.state.performance.canvas?.width} × ${d.state.performance.canvas?.height} · Use game view`;return;}
    if(d.type==='rtc-offer'){acceptVideo(d.sdp).catch(error=>{document.querySelector('#feed-state').textContent='Video: '+error.message;});return;}
    if(d.type==='rtc-ice'){if(receiver?.remoteDescription)receiver.addIceCandidate(d.candidate).catch(()=>{});else receiverCandidates.push(d.candidate);return;}
    const validSize=Number.isInteger(d.width)&&Number.isInteger(d.height)&&d.width>=320&&d.width<=(xrBridge.active?4096:1920)&&d.height>=180&&d.height<=(xrBridge.active?2048:1080);
    if(!validSize)return;
    if(d.type==='bitmap'&&d.bitmap instanceof ImageBitmap){
      try{if(xrBridge.active)xrBridge.upload(d.bitmap);else{context.drawImage(d.bitmap,0,0,1920,1080);presented(d.width,d.height);}}finally{d.bitmap.close();}
      frame.contentWindow.postMessage({channel:CHANNEL,direction:'request',id:'ack-'+d.id,op:'controls.frameAck',session,payload:{id:d.id}},ORIGIN);return;
    }
    if(d.type!=='frame'||!(d.pixels instanceof ArrayBuffer)||d.pixels.byteLength!==d.width*d.height*4)return;
    const bytes=new Uint8ClampedArray(d.pixels);if(d.flipY){const row=d.width*4,temp=new Uint8ClampedArray(row);for(let y=0;y<d.height/2;y++){const a=y*row,b=(d.height-1-y)*row;temp.set(bytes.subarray(a,a+row));bytes.copyWithin(a,b,b+row);bytes.set(temp,b);}}
    const scratch=new OffscreenCanvas(d.width,d.height);scratch.getContext('2d').putImageData(new ImageData(bytes,d.width,d.height),0,0);context.drawImage(scratch,0,0,1920,1080);presented(d.width,d.height);view.dataset.camera=d.state.camera?.name||'';showState(d.state);
  }
});
async function connect(){if(connecting||!modeReady)return;connecting=true;try{videoError=null;closeVideo();const r=await request('controls.connect',renderSettings());connected=true;lastFrame=0;frameTimes=[];startFrames=received;startTime=performance.now();document.querySelector('#connection').textContent='Connected · outside controls active';document.querySelector('#feed-state').textContent='Starting head camera…';diag.textContent=JSON.stringify(r,null,2);showState(r);document.body.classList.toggle('first-render',r.performance?.mode==='first');document.querySelector('#game-view-label').textContent=r.performance?.mode==='first'?'First-person output':'Original view';sendInput();if(r.rtcOffer)await acceptVideo(r.rtcOffer);}catch(e){videoError=e.message;connected=false;document.querySelector('#connection').textContent=e.message;}finally{connecting=false;}}
document.querySelector('#connect').onclick=connect;
function release(){move={x:0,z:0};held.clear();stickPointer=null;document.querySelector('#stick').style.transform='';document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));sendInput();}
document.querySelector('#stop').onclick=async()=>{release();try{if(connected)diag.textContent=JSON.stringify(await request('controls.stop'),null,2);}finally{closeVideo();document.body.classList.remove('first-render');document.querySelector('#game-view-label').textContent='Original view';connected=false;document.querySelector('#connection').textContent='Stopped · controls released';document.querySelector('#feed-state').textContent='Camera stopped';}};
document.querySelector('#inspect').onclick=async()=>{try{diag.textContent=JSON.stringify(await request('runtime.inspect'),null,2);}catch(e){diag.textContent=e.message;}};
const joystick=document.querySelector('#joystick');
function drag(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,dist=Math.hypot(dx,dy),scale=Math.min(1,dist/58);move={x:dist?dx/dist*scale:0,z:dist?dy/dist*scale:0};document.querySelector('#stick').style.transform=`translate(${move.x*58}px,${move.z*58}px)`;joystick.dataset.maxAxis=String(Math.max(Number(joystick.dataset.maxAxis||0),Math.hypot(move.x,move.z)));joystick.dataset.events=String(Number(joystick.dataset.events||0)+1);sendInput();}
joystick.addEventListener('pointerdown',e=>{if(!connected)return;stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);drag(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)drag(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{move={x:0,z:0};stickPointer=null;document.querySelector('#stick').style.transform='';sendInput();});
function bindHold(button,on,off){let started=0,active=false;const down=()=>{if(!connected||active)return;started=performance.now();active=true;button.classList.add('held');on();sendInput();};const up=()=>{if(!active)return;active=false;setTimeout(()=>{button.classList.remove('held');off();sendInput();},Math.max(0,80-(performance.now()-started)));};button.addEventListener('pointerdown',e=>{button.setPointerCapture(e.pointerId);down();});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,up);button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();down();}});button.addEventListener('keyup',up);}
document.querySelectorAll('[data-key]').forEach(b=>bindHold(b,()=>held.add(b.dataset.key),()=>held.delete(b.dataset.key)));
document.querySelectorAll('[data-move]').forEach(b=>{const [x,z]=b.dataset.move.split(',').map(Number);bindHold(b,()=>move={x,z},()=>move={x:0,z:0});});
function sendLook(payload){if(!connected)return;frame.contentWindow.postMessage({channel:CHANNEL,direction:'request',id:'look-'+crypto.randomUUID(),op:'controls.look',session,payload:{...payload,brief:true}},ORIGIN);}
view.addEventListener('pointerdown',e=>{if(!connected)return;lookPointer=e.pointerId;lookLast={x:e.clientX,y:e.clientY};view.setPointerCapture(e.pointerId);view.classList.add('looking');view.focus();});
view.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lookLast.x,dy=e.clientY-lookLast.y;lookLast={x:e.clientX,y:e.clientY};sendLook({delta:{yaw:-dx*.22,pitch:-dy*.22}});});
for(const type of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(type,()=>{lookPointer=null;lookLast=null;view.classList.remove('looking');});
view.addEventListener('keydown',e=>{const delta={ArrowLeft:{yaw:3,pitch:0},ArrowRight:{yaw:-3,pitch:0},ArrowUp:{yaw:0,pitch:3},ArrowDown:{yaw:0,pitch:-3}}[e.code];if(delta){e.preventDefault();sendLook({delta});}});
for(const id of ['yaw','pitch'])document.querySelector('#'+id).addEventListener('input',e=>{if(id==='yaw')yaw=Number(e.target.value);else pitch=Number(e.target.value);sendLook({yaw,pitch});});

const keyboardMap={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};const keyboardDown=new Set();
window.addEventListener('keydown',e=>{if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||!connected||e.target.matches('input,textarea,select'))return;if(keyboardMap[e.code]){e.preventDefault();keyboardDown.add(e.code);updateKeyboard();}else if(/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft)$/.test(e.code)){e.preventDefault();held.add(e.code);sendInput();}});
window.addEventListener('keyup',e=>{keyboardDown.delete(e.code);if(keyboardMap[e.code])updateKeyboard();held.delete(e.code);sendInput();});
function updateKeyboard(){const dirs=new Set([...keyboardDown].map(k=>keyboardMap[k]));move={x:Number(dirs.has('right'))-Number(dirs.has('left')),z:Number(dirs.has('down'))-Number(dirs.has('up'))};sendInput();}
window.addEventListener('blur',()=>{keyboardDown.clear();release();});document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});window.addEventListener('pagehide',release);
let previousPadKeys=new Set(),padMoving=false;
setInterval(()=>{
  if(!connected||document.hidden||immersiveAvailable)return;
  const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
  if(pad){gamepadName=pad.id;const dz=v=>Math.abs(v)<.15?0:v;const x=dz(pad.axes[0]||0),z=dz(pad.axes[1]||0);if(x||z||padMoving)move={x,z};padMoving=!!(x||z);const padKeys=new Set();for(const [index,key]of [[0,'Space'],[1,'KeyE'],[4,'Digit6'],[5,'Digit7'],[10,'ShiftLeft']])if(pad.buttons[index]?.pressed)padKeys.add(key);for(const key of previousPadKeys)if(!padKeys.has(key))held.delete(key);for(const key of padKeys)held.add(key);previousPadKeys=padKeys;const rx=dz(pad.axes[2]||0),ry=dz(pad.axes[3]||0);if(rx||ry)sendLook({delta:{yaw:-rx*3,pitch:-ry*2}});}
  else if(gamepadName){gamepadName=null;for(const key of previousPadKeys)held.delete(key);previousPadKeys.clear();padMoving=false;move={x:0,z:0};}
  sendInput();if(lastFrame&&performance.now()-lastFrame>3000)document.querySelector('#feed-state').textContent='Camera feed interrupted';
},33);
// This check uses exactly the same input messages as the joystick and action buttons.
const test=document.createElement('button');test.textContent='Test movement & camera';document.querySelector('details').append(test);
test.onclick=async()=>{if(!connected){diag.textContent='Connect first.';return;}test.disabled=true;const evidence={before:await request('controls.status'),receivedBefore:received};try{move={x:.6,z:0};sendInput();await new Promise(r=>setTimeout(r,1000));release();await new Promise(r=>setTimeout(r,250));evidence.after=await request('controls.status');evidence.receivedAfter=received;const a=evidence.before.player.position,b=evidence.after.player.position;evidence.distance=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);evidence.cameraFollowing=evidence.after.camera&&Math.abs(evidence.after.camera.position.x-b.x)<1;evidence.passed=evidence.distance>.05&&evidence.receivedAfter>evidence.receivedBefore&&evidence.cameraFollowing;diag.textContent=JSON.stringify(evidence,null,2);}catch(e){diag.textContent=e.message;}finally{release();test.disabled=false;}};

const lookTest=document.createElement('button');lookTest.textContent='Test look & forward movement';document.querySelector('details').append(lookTest);
lookTest.onclick=async()=>{
  if(!connected){diag.textContent='Connect first.';return;}lookTest.disabled=true;const before=await request('controls.status');
  try{
    await request('controls.look',{yaw:-45,pitch:10});await new Promise(r=>setTimeout(r,200));const turned=await request('controls.status');
    move={x:0,z:-.5};sendInput();await new Promise(r=>setTimeout(r,600));release();await new Promise(r=>setTimeout(r,150));const after=await request('controls.status');
    const a=turned.player.position,b=after.player.position,dx=b.x-a.x,dz=b.z-a.z,r=turned.look.yaw*Math.PI/180;
    const distance=Math.hypot(dx,dz),alignment=distance?(-Math.sin(r)*dx-Math.cos(r)*dz)/distance:0;
    const angleError=(a,b)=>Math.abs(((a-b+180)%360+360)%360-180);
    const cameraAligned=angleError(turned.camera.euler.y,turned.look.yaw)<1&&angleError(turned.camera.euler.x,turned.look.pitch)<1;
    const spectatorIndependent=angleError(before.mainCamera.euler.y,turned.mainCamera.euler.y)<1&&angleError(before.mainCamera.euler.x,turned.mainCamera.euler.x)<1;
    diag.textContent=JSON.stringify({before,turned,after,distance,forwardAlignment:alignment,cameraAligned,spectatorIndependent,passed:distance>.05&&alignment>.9&&cameraAligned&&spectatorIndependent},null,2);
    await request('controls.look',{yaw:before.look.yaw,pitch:before.look.pitch});
  }catch(e){diag.textContent=e.message;}finally{release();lookTest.disabled=false;}
};

document.querySelector('#game-url').value=frame.src;
document.querySelector('#load-game').onclick=()=>{const url=document.querySelector('#game-url').value.trim();if(!/^https:\/\/editor\.joinarcade\.ai\/play\/[a-f0-9-]{36}$/.test(url)){document.querySelector('#connection').textContent='Use an Arcade editor play URL.';return;}location.search=new URLSearchParams({game:url}).toString();};

const statusButton=document.createElement('button');statusButton.textContent='Read character & cameras';document.querySelector('details').append(statusButton);statusButton.onclick=async()=>{diag.textContent=JSON.stringify({...await request('controls.status'),clientVideo:{error:videoError,state:receiver?.connectionState,signaling:receiver?.signalingState}},null,2);};

const saveButton=document.createElement('button');saveButton.textContent='Save diagnostics';document.querySelector('details').append(saveButton);saveButton.onclick=()=>{const url=URL.createObjectURL(new Blob([diag.textContent],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='arcade-character-test.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const keyField=document.querySelector('#custom-key'),keyButton=document.querySelector('#custom-action');
let customCode=null;bindHold(keyButton,()=>{const k=keyField.value.trim().toUpperCase();customCode=/^[A-Z]$/.test(k)?'Key'+k:/^[0-9]$/.test(k)?'Digit'+k:null;if(customCode)held.add(customCode);},()=>{if(customCode)held.delete(customCode);customCode=null;});

const headTest=document.createElement('button');headTest.textContent='Test animated head tracking';document.querySelector('details').append(headTest);
headTest.onclick=async()=>{if(!connected)return;headTest.disabled=true;const before=await request('controls.status');try{const samples=[];for(const p of [35,-35]){await request('controls.look',{yaw:-45,pitch:p});await new Promise(r=>setTimeout(r,400));const s=await request('controls.status');if(s.head?.pose){const a=s.head.pose.baseRotation,b=s.head.pose.rotation;const dot=Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)/(Math.hypot(a.x,a.y,a.z,a.w)*Math.hypot(b.x,b.y,b.z,b.w));s.measuredHeadTilt=2*Math.acos(Math.min(1,dot))*180/Math.PI;}samples.push(s);}const angleError=(a,b)=>Math.abs(((a-b+180)%360+360)%360-180);diag.textContent=JSON.stringify({samples,passed:samples.every(s=>s.head?.pose&&Math.abs(s.head.pose.pitch-s.look.pitch)<.01&&s.head.pose.angularError<.05&&angleError(s.camera.euler.x,s.look.pitch)<1&&angleError(s.mainCamera.euler.y,before.mainCamera.euler.y)<1)},null,2);}catch(e){diag.textContent=e.message;}finally{await request('controls.look',{yaw:before.look.yaw,pitch:before.look.pitch});headTest.disabled=false;}};

const bodyTest=document.createElement('button');bodyTest.textContent='Test hidden body looking down';document.querySelector('details').append(bodyTest);
bodyTest.onclick=async()=>{if(!connected)return;bodyTest.disabled=true;const before=await request('controls.status');try{await request('controls.look',{yaw:before.look.yaw,pitch:-80});await new Promise(r=>setTimeout(r,600));const hidden=await request('controls.status');diag.textContent=JSON.stringify({hidden,passed:hidden.body.meshes>0&&hidden.body.headCulls>0&&hidden.body.otherCameraChecks>0&&hidden.frames>before.frames&&hidden.look.pitch===-80},null,2);}catch(e){diag.textContent=e.message;}finally{bodyTest.disabled=false;}};

const instantTest=document.createElement('button');instantTest.textContent='Test instant head response';document.querySelector('details').append(instantTest);
instantTest.onclick=async()=>{if(!connected)return;instantTest.disabled=true;const before=await request('controls.status');try{const samples=[];for(const target of [{yaw:-110,pitch:60},{yaw:95,pitch:-55},{yaw:0,pitch:0}]){const immediate=await request('controls.look',target);await new Promise(r=>setTimeout(r,150));const rendered=await request('controls.status');const a=immediate.head?.pose?.rotation,b=rendered.head?.pose?.rotation;const dot=a&&b?Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)/(Math.hypot(a.x,a.y,a.z,a.w)*Math.hypot(b.x,b.y,b.z,b.w)):0;const drift=2*Math.acos(Math.min(1,dot))*180/Math.PI;samples.push({target,immediate,rendered,drift});}diag.textContent=JSON.stringify({samples,passed:samples.every(s=>s.immediate.head?.pose?.mode==='instant'&&s.immediate.head.pose.angularError<.05&&s.rendered.head.pose.angularError<.05&&s.drift<.05)},null,2);}catch(e){diag.textContent=e.message;}finally{await request('controls.look',{yaw:before.look.yaw,pitch:before.look.pitch});instantTest.disabled=false;}};

for(const id of ['quality','transport'])document.querySelector('#'+id).onchange=()=>{if(connected)connect();};
for(const id of ['tone','exposure'])document.querySelector('#'+id).oninput=()=>{if(connected)request('controls.color',renderSettings()).catch(e=>{document.querySelector('#feed-state').textContent=e.message;});};
const benchmark=document.createElement('button');benchmark.textContent='Benchmark rendering modes';document.querySelector('details').append(benchmark);
benchmark.onclick=async()=>{if(!connected)return;benchmark.disabled=true;window.scrollTo(0,0);const original=renderSettings(),results=[];try{for(const preset of [{name:'Original',quality:'legacy',transport:'pixels',tone:'aces',exposure:1},{name:'720p GPU',quality:'balanced',transport:'bitmap',tone:'neutral',exposure:1},{name:'1080p GPU',quality:'sharp',transport:'bitmap',tone:'neutral',exposure:1}]){for(const id of ['quality','transport','tone','exposure'])document.querySelector('#'+id).value=String(preset[id]);await connect();await new Promise(r=>setTimeout(r,2000));const begin=performance.now(),frames=received;await new Promise(r=>setTimeout(r,8000));const elapsed=performance.now()-begin,state=await request('controls.status');let videoStats=null;if(receiver){const stats=await receiver.getStats();for(const item of stats.values())if(item.type==='inbound-rtp'&&item.kind==='video'){const codec=stats.get(item.codecId);videoStats={framesDecoded:item.framesDecoded,framesDropped:item.framesDropped,fps:item.framesPerSecond,width:item.frameWidth,height:item.frameHeight,codec:codec?.mimeType,decoder:item.decoderImplementation};}}results.push({name:preset.name,elapsedMs:elapsed,deliveredFPS:preset.transport==='direct'?state.performance.renderFPS:(received-frames)*1000/elapsed,performance:state.performance,video:videoStats,streamError:state.streamError,clientVideo:{error:videoError,state:receiver?.connectionState}});diag.textContent=JSON.stringify({running:true,results},null,2);}diag.textContent=JSON.stringify({results,passed:results.slice(1).every(r=>r.deliveredFPS>20&&r.performance.mode==='compare'&&!r.streamError)},null,2);}catch(e){diag.textContent=JSON.stringify({error:e.message,results},null,2);}finally{const evidence=diag.textContent;for(const id of ['quality','transport','tone','exposure'])document.querySelector('#'+id).value=String(original[id]);await connect();diag.textContent=evidence;benchmark.disabled=false;}};

frame.addEventListener('load',()=>{session=null;connected=false;});
async function initializeMode(){
  immersiveAvailable=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false);
  document.body.dataset.mode=immersiveAvailable?'vr':'debug';
  if(immersiveAvailable)document.querySelector('#transport').value='direct';
  const match=location.pathname.match(/^\/play\/([a-f0-9-]{36})\/?$/);
  const legacy=new URLSearchParams(location.search).get('game');
  const id=match?.[1]||legacy?.match(/\/play\/([a-f0-9-]{36})/)?.[1]||'b64642d7-d51d-458c-8a5f-108ca45431b2';
  const engine=new URL(location.href);engine.hostname=location.hostname==='localhost'||location.hostname==='editor.localhost'||location.hostname.endsWith('.localhost')?'runtime.joinarcade.localhost':location.hostname.replace(/^editor\./,'runtime.');engine.pathname='/play/'+id;engine.search=location.search;engine.searchParams.delete('game');engine.searchParams.delete('debug');engine.searchParams.set('xr',immersiveAvailable?'1':'0');engine.hash='';
  ORIGIN=engine.origin;modeReady=true;frame.src=engine.href;
}
setInterval(()=>{if(modeReady&&!connected&&!connecting&&!document.hidden)connect();},1200);
const liveViewport=document.querySelector('.live-view');new ResizeObserver(()=>{frame.style.transform=immersiveAvailable?'none':`scale(${liveViewport.clientWidth/1920})`;}).observe(liveViewport);
initializeMode().catch(error=>{document.querySelector('#connection').textContent=error.message;});

const xrButton=document.createElement('button');xrButton.textContent='Enter VR';xrButton.hidden=true;xrButton.setAttribute('aria-label','Enter virtual reality');
xrButton.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;background:#fff;color:#000;border:0;border-radius:6px;padding:14px 24px;font:600 16px system-ui;cursor:pointer';document.body.append(xrButton);
const xrBridge=window.createArcadeXRBridge({request,send:(op,payload)=>frame.contentWindow.postMessage({channel:CHANNEL,direction:'request',id:'xr-'+crypto.randomUUID(),op,payload,session},ORIGIN),onState:text=>{xrButton.textContent=text;xrButton.hidden=xrBridge.active||xrBridge.starting;}});
xrButton.onclick=()=>xrBridge.start().catch(error=>{xrButton.textContent='Retry VR · '+error.message;xrButton.hidden=false;});
window.addEventListener('pagehide',()=>xrBridge.end());
