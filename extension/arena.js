(() => {
  'use strict';
  if (!window.__arcadeVRLab || window.__arcadeControls) return;
  const CHANNEL='arcade-vr-lab-v1', session=window.__arcadeVRLab.session;
  const getApp=()=>window.pcApp||window.gameManager?.getApp?.();
  const service=()=>window.gameManager?.getPlayerControlService?.();
  const plugin=()=>window.gameManager?.getGameLogicPlugin?.();
  const player=()=>service()?.controlledEntity || plugin()?.getLocalPlayerEntity?.() || plugin()?.playerEntity;
  const mainCamera=()=>{const c=window.gameManager?.getViewCamera?.();return c?.entity||c;};
  const tps=()=>service()?.getTpsCamera?.();
  const fps=()=>service()?.getFpsController?.()||window.gameManager?.getFPSController?.()||window.gameManager?.playModeController?.fpsController;
  const cameraLook=()=>{const c=mainCamera();if(!c)return null;const f=c.getRotation().transformVector(window.pc.Vec3.FORWARD,new window.pc.Vec3());return{yaw:Math.atan2(-f.x,-f.z)*180/Math.PI,pitch:Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI,roll:0};};
  const look=()=>connected?{yaw,pitch,roll:0}:cameraLook();
  const vector=v=>v?{x:v.x,y:v.y,z:v.z}:null;
  const all=root=>{const out=[],q=root?[root]:[];while(q.length&&out.length<3000){const e=q.shift();out.push(e);q.push(...e.children);}return out;};
  function describe(o){if(!o)return null;const methods=new Set();let p=o;for(let d=0;p&&d<3;d++,p=Object.getPrototypeOf(p))for(const k of Object.getOwnPropertyNames(p)){try{if(typeof o[k]==='function')methods.add(k);}catch{}}return{type:o.constructor?.name,keys:Object.keys(o).slice(0,120),methods:[...methods].slice(0,180)};}
  function getInput(){const gm=window.gameManager,s=service();for(const c of [s?.getPlayRigController?.(),gm?.getFPSController?.(),gm?.playModeController?.fpsController,s?.getFpsController?.()]){const i=c?.getInputManager?.()||c?.inputManager;if(i?.addSource)return i;}return null;}
  function inspect(){const gm=window.gameManager,s=service(),p=player(),i=getInput();return{gm:describe(gm),player:p?{name:p.name,id:p.getGuid(),position:vector(p.getPosition()),children:all(p).map(e=>({name:e.name,position:vector(e.getPosition())})).slice(0,90)}:null,service:describe(s),input:describe(i),movementBindings:i?.getMovementBindings?.(),actionBindings:i?.getActionBindings?.(),playRig:describe(s?.getPlayRigController?.()),gameApi:describe(plugin()?.getRuntimeApi?.()),tps:describe(tps()),tpsOrbit:tps()?.orbitState,look:look(),cameras:getApp()?.root.findComponents('camera').map(c=>({name:c.entity.name,enabled:c.enabled,layers:c.layers,position:vector(c.entity.getPosition())}))};}
  let owner=null,input=null,source=null,headCamera=null,texture=null,target=null,loopApp=null,head=null,trackedPlayer=null;
  let headBaseLocal=null,headApplied=null,headReference=null,avatarYaw=null,avatarYawBaseLocal=null;
  let bodyHidden=true,bodyHeadCulls=0,bodyOtherChecks=0;
  const bodyMeshes=new Map();
  function restoreBody(){for(const [mesh,saved]of bodyMeshes){if(mesh.isVisibleFunc===saved.filter){mesh.isVisibleFunc=saved.original;mesh.cull=saved.cull;}}bodyMeshes.clear();}
  function filterBody(p){
    const current=new Set(all(p).flatMap(e=>[...(e.render?.meshInstances||[]),...(e.model?.meshInstances||e.model?.model?.meshInstances||[])]));
    for(const [mesh,saved]of bodyMeshes)if(!current.has(mesh)){if(mesh.isVisibleFunc===saved.filter){mesh.isVisibleFunc=saved.original;mesh.cull=saved.cull;}bodyMeshes.delete(mesh);}
    for(const mesh of current)if(!bodyMeshes.has(mesh)){
      const saved={original:mesh.isVisibleFunc,cull:mesh.cull,filter:null};
      // Camera-specific culling keeps the avatar, animation and shadows intact
      // for other cameras; never mutate shared materials or entity enablement.
      saved.filter=function(camera){
        if(bodyHidden&&camera===headCamera?.camera.camera){bodyHeadCulls++;return false;}
        bodyOtherChecks++;
        return saved.original?saved.original.call(this,camera):!saved.cull||camera.frustum.containsAabb(this.aabb);
      };
      mesh.isVisibleFunc=saved.filter;mesh.cull=true;bodyMeshes.set(mesh,saved);
    }
  }
  function restoreHead(){if(head&&headBaseLocal)head.setLocalRotation(headBaseLocal);headBaseLocal=null;if(avatarYaw&&avatarYawBaseLocal)avatarYaw.setLocalRotation(avatarYawBaseLocal);avatarYawBaseLocal=null;}
  let connected=false,keys=new Set(),move={x:0,z:0},yaw=0,pitch=0,lastInput=0,lastRead=0,reading=false,frameCount=0,streamError=null;
  const KEY={KeyW:[87,'w'],KeyA:[65,'a'],KeyS:[83,'s'],KeyD:[68,'d'],KeyE:[69,'e'],Digit6:[54,'6'],Digit7:[55,'7'],Space:[32,' '],ShiftLeft:[16,'Shift'],KeyC:[67,'c']};
  for(let n=65;n<=90;n++)KEY['Key'+String.fromCharCode(n)]=[n,String.fromCharCode(n).toLowerCase()];
  for(let n=0;n<=9;n++)KEY['Digit'+n]=[48+n,String(n)];
  function emitKey(code,down){const k=KEY[code];if(!k)return;const ev=new KeyboardEvent(down?'keydown':'keyup',{key:k[1],code,keyCode:k[0],which:k[0],bubbles:true,cancelable:true});window.dispatchEvent(ev);}
  function setKeys(next){for(const k of keys)if(!next.has(k))emitKey(k,false);for(const k of next)if(!keys.has(k))emitKey(k,true);keys=next;}
  function release(){setKeys(new Set());move={x:0,z:0};}
  function status(){const p=player();return{version:'0.5.3',connected,session,player:p?{id:p.getGuid(),name:p.name,position:vector(p.getPosition()),euler:vector(p.getEulerAngles()),forwardAxis:"+Z"}:null,head:head?{name:head.name,position:vector(head.getPosition()),pose:headApplied}:null,camera:headCamera?{name:headCamera.name,position:vector(headCamera.getPosition()),euler:vector(headCamera.getEulerAngles())}:null,move,keys:[...keys],frames:frameCount,streamError,inputSource:!!source,body:{mode:bodyHidden?'hidden':'visible',meshes:bodyMeshes.size,headCulls:bodyHeadCulls,otherCameraChecks:bodyOtherChecks},look:look(),mainCamera:window.__arcadeVRLab.snapshot().camera};}
  function send(data,transfer=[]){if(owner)owner.source.postMessage({channel:CHANNEL,direction:'stream',session,...data},owner.origin,transfer);}
  function placeHead(){
    if(!connected)return;
    if(performance.now()-lastInput>750)release();
    const p=player();if(!p)return;
    restoreHead();
    filterBody(p);
    if(p!==trackedPlayer||!head||!head.parent){trackedPlayer=p;const nodes=all(p);head=nodes.find(e=>/^(mixamorig:)?head$/i.test(e.name))||null;avatarYaw=nodes.find(e=>/_MoldYaw$/.test(e.name))||null;headReference=null;}
    // Camera looks down -Z; Arcade character models face +Z.
    // Keep player look independent of the spectator camera's orbit.
    const pose=new window.pc.Quat().setFromEulerAngles(pitch,yaw,0);
    p.setEulerAngles(0,yaw+180,0);
    const bodyRotation=new window.pc.Quat().setFromEulerAngles(0,yaw+180,0);
    // Arcade rotates a separate visual wrapper, which can smooth or follow the
    // native camera independently of the physics root. Override at render time.
    if(avatarYaw){avatarYawBaseLocal=avatarYaw.getLocalRotation().clone();avatarYaw.setRotation(bodyRotation);}
    if(head){
      headBaseLocal=head.getLocalRotation().clone();
      const base=head.getRotation().clone();
      // Keep one model-axis calibration, not the current animated/lerped pose.
      // Absolute orientation makes yaw and pitch snap to the latest view input.
      if(!headReference)headReference=bodyRotation.clone().invert().mul(base);
      const rotation=pose.clone().mul(new window.pc.Quat().setFromEulerAngles(0,180,0)).mul(headReference);
      head.setRotation(rotation);
      const actual=head.getRotation();
      const dot=Math.abs(actual.x*rotation.x+actual.y*rotation.y+actual.z*rotation.z+actual.w*rotation.w)/(Math.hypot(actual.x,actual.y,actual.z,actual.w)*Math.hypot(rotation.x,rotation.y,rotation.z,rotation.w));
      const quat=q=>({x:q.x,y:q.y,z:q.z,w:q.w});
      headApplied={mode:'instant',pitch,yaw,euler:vector(head.getEulerAngles()),baseRotation:quat(base),rotation:quat(actual),targetRotation:quat(rotation),referenceRotation:quat(headReference),angularError:2*Math.acos(Math.min(1,dot))*180/Math.PI,avatarYaw:avatarYaw?{name:avatarYaw.name,euler:vector(avatarYaw.getEulerAngles())}:null};
    }else headApplied=null;
    const pos=head?.getPosition()||p.getPosition();
    const forward=pose.transformVector(window.pc.Vec3.FORWARD,new window.pc.Vec3());
    headCamera.setPosition(pos.x+forward.x*.35,pos.y+(head ? .12 : 1.6)+forward.y*.35,pos.z+forward.z*.35);
    headCamera.setRotation(pose);

  }
  async function readFrame(){
    if(!connected||reading||performance.now()-lastRead<80)return;
    reading=true;lastRead=performance.now();const tex=texture,rt=target;
    try{
      const pixels=await tex.read(0,0,640,360,{renderTarget:rt,immediate:true});
      if(!connected||texture!==tex)return;
      frameCount++;
      send({type:'frame',width:640,height:360,pixels:pixels.buffer,flipY:loopApp.graphicsDevice.deviceType==='webgl2',state:status()},[pixels.buffer]);
    }catch(e){streamError=String(e.message||e);send({type:'error',error:streamError});}finally{reading=false;}
  }
  function stop(){release();restoreHead();restoreBody();headApplied=null;connected=false;if(input&&source)input.removeSource(source);source=null;input=null;if(loopApp){loopApp.off('prerender',placeHead);loopApp.off('postrender',readFrame);loopApp.off('postrender',restoreHead);}headCamera?.destroy();target?.destroy();texture?.destroy();headCamera=texture=target=null;owner=null;return status();}
  function connect(ctx){
    if(ctx.source!==window.parent||window.parent===window)throw Error('Connect from the outside wrapper.');
    const a=getApp(),pc=window.pc,p=player();if(!a||!pc||!p)throw Error('Start the game inside the embed first.');
    stop();owner=ctx;input=getInput();if(!input)throw Error('Live input manager was not found.');
    source={id:'hackathon-outside-joystick',attach(){},detach(){},lastActivityAt:()=>Date.now(),
      readMove(out){const length=Math.max(1,Math.hypot(move.x,move.z));const h=yaw*Math.PI/180,m=(cameraLook()?.yaw||0)*Math.PI/180;
      const wx=Math.cos(h)*move.x+Math.sin(h)*move.z,wz=-Math.sin(h)*move.x+Math.cos(h)*move.z;
      out.x=(Math.cos(m)*wx-Math.sin(m)*wz)/length;out.z=(Math.sin(m)*wx+Math.cos(m)*wz)/length;return Math.abs(move.x)+Math.abs(move.z)>.001;},consumeLook(out){out.x=out.y=0;},consumeWheel:()=>0,isJump:()=>keys.has('Space'),isSprint:()=>keys.has('ShiftLeft'),isCrouch:()=>keys.has('KeyC'),isKeyPressed:()=>false,isCodePressed:code=>keys.has(code),readActions(out,bindings){for(const [name,codes]of Object.entries(bindings))if(codes.some(code=>keys.has(code)))out[name]=1;},releaseAll:release};
    input.addSource(source);
    // Seed eye direction from the character's +Z heading, not the orbit camera.
    const facing=p.getRotation().transformVector(new pc.Vec3(0,0,1),new pc.Vec3());yaw=Math.atan2(-facing.x,-facing.z)*180/Math.PI;pitch=0;
    texture=new pc.Texture(a.graphicsDevice,{name:'HackathonHeadFeed',width:640,height:360,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});
    target=new pc.RenderTarget({colorBuffer:texture,depth:true,samples:1});
    headCamera=new pc.Entity('HackathonPlayerHeadCamera');a.root.addChild(headCamera);
    const main=window.gameManager.getViewCamera();const c=main.camera||main;
    headCamera.addComponent('camera',{clearColor:c.clearColor,clearColorBuffer:true,clearDepthBuffer:true,nearClip:.15,farClip:c.farClip||1000,fov:80,priority:-10,layers:[...c.layers].filter(id=>id!==pc.LAYERID_UI),renderTarget:target});
    headCamera.camera.toneMapping=pc.TONEMAP_ACES;headCamera.camera.gammaCorrection=pc.GAMMA_SRGB;
    loopApp=a;trackedPlayer=null;head=null;headReference=null;avatarYaw=null;connected=true;bodyHidden=true;bodyHeadCulls=bodyOtherChecks=0;frameCount=0;lastInput=performance.now();streamError=null;
    a.on('prerender',placeHead);a.on('postrender',readFrame);a.on('postrender',restoreHead);placeHead();
    const panel=document.querySelector('#arcade-vr-lab-panel');if(panel)panel.style.display='none';
    return{...status(),movementBindings:input.getMovementBindings?.(),actionBindings:input.getActionBindings?.()};
  }
  function applyLook(payload){
    const finite=(n,max)=>Number.isFinite(n)?Math.max(-max,Math.min(max,n)):0;
    let y=payload.yaw,p=payload.pitch;
    if(payload.orientation){
      const q=payload.orientation;if(!['x','y','z','w'].every(k=>Number.isFinite(q[k])))throw Error('Expected a finite orientation quaternion');
      const len=Math.hypot(q.x,q.y,q.z,q.w);if(len<.001)throw Error('Invalid orientation quaternion');
      const f=new window.pc.Quat(q.x/len,q.y/len,q.z/len,q.w/len).transformVector(window.pc.Vec3.FORWARD,new window.pc.Vec3());y=Math.atan2(-f.x,-f.z)*180/Math.PI;p=Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI;
    }
    const current=look();if(payload.delta){y=current.yaw+finite(payload.delta.yaw,180);p=current.pitch+finite(payload.delta.pitch,180);}
    y=((finite(y,1e6)+180)%360+360)%360-180;p=finite(p,80);
    yaw=y;pitch=p;lastInput=performance.now();placeHead();return status();
  }
  window.__arcadeControls={execute:async(r,ctx)=>{
    if(r.op==='runtime.inspect')return inspect();
    if(r.op==='controls.connect')return connect(ctx);
    if(r.op==='controls.status')return status();
    if(!connected||ctx.source!==owner?.source||ctx.origin!==owner?.origin)throw Error('Connect the outside controls first.');
    if(r.op==='controls.stop')return stop();
    if(r.op==='controls.body'){bodyHidden=r.payload?.visible!==true;return status();}
    if(r.op==='controls.look')return applyLook(r.payload||{});
    if(r.op==='controls.input'){
      const d=r.payload||{},finite=(n,limit)=>Number.isFinite(n)?Math.max(-limit,Math.min(limit,n)):0;
      move={x:finite(d.x,1),z:finite(d.z,1)};lastInput=performance.now();
      setKeys(new Set((Array.isArray(d.keys)?d.keys:[]).filter(k=>Object.hasOwn(KEY,k))));return status();
    }
    throw Error('Unsupported control operation '+r.op);
  }};
  window.addEventListener('pagehide',stop);
})();
