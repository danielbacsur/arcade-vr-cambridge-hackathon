(() => {
  'use strict';
  if (!window.__arcadeVRLab || window.__arcadeControls) return;
  const CHANNEL='arcade-vr-lab-v1', session=window.__arcadeVRLab.session;
  const getApp=()=>window.pcApp||window.gameManager?.getApp?.();
  const service=()=>window.gameManager?.getPlayerControlService?.();
  const plugin=()=>window.gameManager?.getGameLogicPlugin?.();
  const player=()=>service()?.controlledEntity || plugin()?.getLocalPlayerEntity?.() || plugin()?.playerEntity;
  const gameReady=()=>!!player()&&!!getApp()?.root.findComponents('render').length&&!Array.from(document.querySelectorAll('button')).some(b=>/^(Start Game|Start Adventure|Start)$/i.test(b.textContent.trim())&&b.getClientRects().length);
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
  let stereo=null;
  let xrRig=null,xrEyeHeight=null,xrHeadHeight=null,captureCanvas=null,captureContext=null;
  let owner=null,input=null,source=null,headCamera=null,texture=null,target=null,loopApp=null,head=null,trackedPlayer=null;
  let headBaseLocal=null,headApplied=null,headReference=null,avatarYaw=null,avatarYawBaseLocal=null;
  let bodyHidden=true,bodyHeadCulls=0,bodyOtherChecks=0;
  const bodyMeshes=new Map();
  let settings={mode:'first',transport:'bitmap',width:1280,height:720,fps:60,exposure:1,tone:'neutral'};
  let lastScan=0,lastCameraScan=0,lastState=0,lastRender=0,renderCount=0,renderIntervals=[],captureTimes=[],ackPending=0,captureId=0;
  let originalFrameEnd=null,wrappedFrameEnd=null;
  let canvasSaved=null,exposureSaved=null,peer=null,captureStream=null,rtcCandidates=[];
  const savedCameras=new Map();
  function performanceState(){const a=getApp(),f=a?.stats?.frame;const mean=v=>v.length?v.reduce((x,y)=>x+y,0)/v.length:0;return{...settings,renderFPS:renderIntervals.length?1000/mean(renderIntervals):0,captureMs:mean(captureTimes),drawCalls:a?.stats?.drawCalls?.total,triangles:f?.triangles,canvas:a?{width:a.graphicsDevice.width,height:a.graphicsDevice.height}:null,activeCameras:a?.root.findComponents('camera').filter(c=>c.enabled&&c.entity.enabled).map(c=>c.entity.name),peer:peer?.connectionState||null,color:{tone:settings.tone,gamma:'sRGB',sceneExposure:a?.scene.exposure,physicalUnits:a?.scene.physicalUnits},renderCount,xr:{supported:!!a?.xr?.supported,available:!!a?.xr?.isAvailable?.('immersive-vr'),active:!!a?.xr?.active,backend:a?.graphicsDevice?.deviceType,stereo:!!a?.xr?.active||!!stereo}};}
  function guardRendering(){
    if(!['first','stereo'].includes(settings.mode))return;
    if(performance.now()-lastCameraScan>1000||!savedCameras.size){lastCameraScan=performance.now();for(const c of loopApp.root.findComponents('camera'))if(c!==headCamera.camera&&c!==stereo?.right.camera&&!savedCameras.has(c))savedCameras.set(c,c.enabled);}
    for(const c of savedCameras.keys())c.enabled=false;
    if(exposureSaved!==null)loopApp.scene.exposure=exposureSaved*settings.exposure;
  }
  function restoreRendering(){
    for(const [c,enabled]of savedCameras)if(c.entity?.parent)c.enabled=enabled;savedCameras.clear();
    if(loopApp&&canvasSaved){loopApp.graphicsDevice.maxPixelRatio=canvasSaved.ratio;loopApp.setCanvasResolution(canvasSaved.mode,canvasSaved.width/canvasSaved.ratio,canvasSaved.height/canvasSaved.ratio);}
    if(loopApp&&exposureSaved!==null)loopApp.scene.exposure=exposureSaved;
    canvasSaved=null;exposureSaved=null;captureContext?.unconfigure();captureCanvas=captureContext=null;
    peer?.close();peer=null;captureStream?.getTracks().forEach(t=>t.stop());captureStream=null;rtcCandidates=[];ackPending=0;
  }
  async function startVideo(){
    const pc=peer=new RTCPeerConnection({iceServers:[]});
    captureStream=loopApp.graphicsDevice.canvas.captureStream(settings.fps);
    const track=captureStream.getVideoTracks()[0];track.contentHint='motion';
    const sender=pc.addTrack(track,captureStream),transceiver=pc.getTransceivers()[0];
    const codecs=RTCRtpSender.getCapabilities('video')?.codecs||[];
    if(transceiver?.setCodecPreferences)transceiver.setCodecPreferences([...codecs.filter(c=>c.mimeType.toLowerCase()==='video/h264'),...codecs.filter(c=>c.mimeType.toLowerCase()!=='video/h264')]);
    pc.onicecandidate=e=>{if(peer===pc&&e.candidate)send({type:'rtc-ice',candidate:e.candidate.toJSON()});};
    pc.onconnectionstatechange=()=>{if(peer===pc&&pc.connectionState==='failed'){streamError='Video connection failed. Choose GPU frames.';send({type:'error',error:streamError});}};
    await pc.setLocalDescription(await pc.createOffer());if(peer!==pc)return;
    const parameters=sender.getParameters();if(parameters.encodings?.length){parameters.encodings[0].maxBitrate=settings.width>=1920?18000000:10000000;parameters.encodings[0].maxFramerate=settings.fps;await sender.setParameters(parameters);}
    // Offer is returned by connect so the wrapper has established its session first.
  }
  function restoreBody(){for(const [mesh,saved]of bodyMeshes){if(mesh.isVisibleFunc===saved.filter){mesh.isVisibleFunc=saved.original;mesh.cull=saved.cull;}}bodyMeshes.clear();}
  function filterBody(p){
    const current=new Set(all(p).flatMap(e=>[...(e.render?.meshInstances||[]),...(e.model?.meshInstances||e.model?.model?.meshInstances||[])]));
    for(const [mesh,saved]of bodyMeshes)if(!current.has(mesh)){if(mesh.isVisibleFunc===saved.filter){mesh.isVisibleFunc=saved.original;mesh.cull=saved.cull;}bodyMeshes.delete(mesh);}
    for(const mesh of current)if(!bodyMeshes.has(mesh)){
      const saved={original:mesh.isVisibleFunc,cull:mesh.cull,filter:null};
      // Camera-specific culling keeps the avatar, animation and shadows intact
      // for other cameras; never mutate shared materials or entity enablement.
      saved.filter=function(camera){
        if(bodyHidden&&(camera===headCamera?.camera.camera||camera===stereo?.right.camera.camera)){bodyHeadCulls++;return false;}
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
  function status(){const p=player();return{version:'0.8.0',connected,gameReady:gameReady(),session,player:p?{id:p.getGuid(),name:p.name,position:vector(p.getPosition()),euler:vector(p.getEulerAngles()),forwardAxis:"+Z"}:null,head:head?{name:head.name,position:vector(head.getPosition()),pose:headApplied}:null,camera:headCamera?{name:headCamera.name,position:vector(headCamera.getPosition()),euler:vector(headCamera.getEulerAngles())}:null,move,keys:[...keys],frames:frameCount,streamError,inputSource:!!source,body:{mode:bodyHidden?'hidden':'visible',meshes:bodyMeshes.size,headCulls:bodyHeadCulls,otherCameraChecks:bodyOtherChecks},look:look(),mainCamera:window.__arcadeVRLab.snapshot().camera,performance:performanceState()};}
  function send(data,transfer=[]){if(owner)owner.source.postMessage({channel:CHANNEL,direction:'stream',session,...data},owner.origin,transfer);}
  function placeHead(){
    if(!connected)return;
    if(loopApp?.xr?.active)readXR();else if(!stereo&&performance.now()-lastInput>750)release();
    const p=player();if(!p)return;
    restoreHead();
    if(p!==trackedPlayer||performance.now()-lastScan>1000){filterBody(p);lastScan=performance.now();}
    guardRendering();
    if(settings.mode==='compare'&&headCamera){const now=performance.now();headCamera.camera.enabled=!reading&&(!ackPending||now-ackPending>=1000)&&now-lastRead>=1000/settings.fps-2;}
    if(p!==trackedPlayer||!head||!head.parent){trackedPlayer=p;const nodes=all(p);head=nodes.find(e=>/^(mixamorig:)?head$/i.test(e.name))||null;avatarYaw=nodes.find(e=>/_MoldYaw$/.test(e.name))||null;headReference=null;}
    // Camera looks down -Z; Arcade character models face +Z.
    // Keep player look independent of the spectator camera's orbit.
    const pose=stereo?.orientation||(loopApp.xr?.active?headCamera.getRotation().clone():new window.pc.Quat().setFromEulerAngles(pitch,yaw,0));
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
    if(stereo){placeStereoEyes(pos,head ? .12 : 1.6);return;}
    if(loopApp.xr?.active)return;
    headCamera.setPosition(pos.x+forward.x*.35,pos.y+(head ? .12 : 1.6)+forward.y*.35,pos.z+forward.z*.35);
    headCamera.setRotation(pose);

  }
  function readXR(){
    const p=player();if(!p||!headCamera||!xrRig)return;
    const local=headCamera.getLocalPosition();
    if(xrEyeHeight===null&&local.y>.1){xrEyeHeight=local.y;xrHeadHeight=head?head.getPosition().y-p.getPosition().y+.12:1.6;}
    const pos=p.getPosition();xrRig.setPosition(pos.x,pos.y+(xrHeadHeight??1.6)-(xrEyeHeight??1.6),pos.z);
    const f=headCamera.getRotation().transformVector(window.pc.Vec3.FORWARD,new window.pc.Vec3());
    yaw=Math.atan2(-f.x,-f.z)*180/Math.PI;pitch=Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI;
    const sources=loopApp.xr.input.inputSources,left=sources.find(s=>s.handedness==='left'),right=sources.find(s=>s.handedness==='right');
    const axes=left?.gamepad?.axes||[];const dead=v=>Math.abs(v||0)>.15?v:0;
    move={x:dead(axes.length>=4?axes[2]:axes[0]),z:dead(axes.length>=4?axes[3]:axes[1])};
    const next=new Set();for(const [pad,index,key]of [[right?.gamepad,4,'Space'],[right?.gamepad,5,'KeyR'],[left?.gamepad,4,'KeyQ'],[left?.gamepad,0,'KeyF'],[right?.gamepad,0,'KeyE'],[left?.gamepad,3,'ShiftLeft']])if(pad?.buttons[index]?.pressed)next.add(key);
    setKeys(next);lastInput=performance.now();
  }
  window.__arcadeStartXR=()=>{
    const a=loopApp;if(!connected||!headCamera)throw Error('The game is still loading.');
    if(!a.xr?.isAvailable('immersive-vr'))throw Error('Immersive VR is unavailable for this graphics backend.');
    xrEyeHeight=xrHeadHeight=null;xrRig.setPosition(player().getPosition());xrRig.setEulerAngles(0,yaw,0);headCamera.setLocalPosition(0,0,0);headCamera.setLocalEulerAngles(0,0,0);
    a.xr.start(headCamera.camera,window.pc.XRTYPE_VR,window.pc.XRSPACE_LOCALFLOOR,{framebufferScaleFactor:1,callback:error=>{if(error)send({type:'error',error:error.message});}});
  };
  function startStereo(data){
    if(stereo)throw Error('VR is already running.');
    if(settings.mode!=='first'||!loopApp.graphicsDevice.wgpu)throw Error('VR requires the WebGPU first-person renderer.');
    const pc=window.pc,a=loopApp;
    const width=Math.round(Math.max(512,Math.min(1536,Number(data.eyeWidth)||1024))),height=Math.round(Math.max(512,Math.min(2048,Number(data.eyeHeight)||1024)));
    const previous={...settings},cam=headCamera.camera;
    const right=new pc.Entity('HackathonRightEye');xrRig.addChild(right);
    right.addComponent('camera',{clearColor:cam.clearColor,clearColorBuffer:false,clearDepthBuffer:true,nearClip:cam.nearClip,farClip:cam.farClip,priority:101,layers:[...cam.layers]});
    for(const key of ['aperture','shutter','sensitivity','toneMapping','gammaCorrection'])right.camera[key]=cam[key];
    texture=new pc.Texture(a.graphicsDevice,{name:'HackathonStereoFeed',width:width*2,height,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});
    target=new pc.RenderTarget({colorBuffer:texture,depth:true,samples:1});
    captureCanvas=new OffscreenCanvas(width*2,height);captureContext=captureCanvas.getContext('webgpu');
    captureContext.configure({device:a.graphicsDevice.wgpu,format:'rgba8unorm',alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
    stereo={right,previous,requestAnimationFrame:a.requestAnimationFrame,autoRender:a.autoRender,calcProjection:cam.calculateProjection,rect:cam.rect.clone(),yawOffset:new pc.Quat().setFromEulerAngles(0,yaw,0),orientation:new pc.Quat().setFromEulerAngles(pitch,yaw,0),center:null,origin:null,views:null,projection:[new pc.Mat4(),new pc.Mat4()]};
    settings={...settings,mode:'stereo',transport:'bitmap',width:width*2,height,fps:90};
    cam.renderTarget=right.camera.renderTarget=target;cam.rect=new pc.Vec4(0,0,.5,1);right.camera.rect=new pc.Vec4(.5,0,.5,1);
    cam.calculateProjection=out=>out.copy(stereo.projection[0]);right.camera.calculateProjection=out=>out.copy(stereo.projection[1]);
    right.camera.enabled=false;cam.enabled=false;
    if(a.frameRequestId)cancelAnimationFrame(a.frameRequestId);a.frameRequestId=null;a.requestAnimationFrame=()=>{};
    ackPending=0;return {width:width*2,height};
  }
  function placeStereoEyes(base,height){
    if(!stereo?.views||!stereo.origin)return;
    const pc=window.pc,s=stereo;
    for(let i=0;i<2;i++){
      const v=s.views[i],position=s.yawOffset.transformVector(new pc.Vec3(v.position.x-s.origin.x,v.position.y-s.origin.y,v.position.z-s.origin.z),new pc.Vec3());
      const eye=i?s.right:headCamera;
      eye.setPosition(base.x+position.x,base.y+height+position.y,base.z+position.z);
      eye.setRotation(s.yawOffset.clone().mul(new pc.Quat(v.orientation.x,v.orientation.y,v.orientation.z,v.orientation.w)));
    }
  }
  function updateStereo(data){
    if(!stereo||!data.center||!Array.isArray(data.views)||data.views.length!==2)return null;
    const values=[data.center.position,data.center.orientation,...data.views.flatMap(v=>[v.position,v.orientation])];
    if(!values.every(v=>v&&Object.values(v).every(Number.isFinite))||!data.views.every(v=>Array.isArray(v.projection)&&v.projection.length===16&&v.projection.every(Number.isFinite)))throw Error('Invalid XR pose');
    const pc=window.pc,s=stereo,c=data.center;
    if(!s.origin)s.origin={...c.position};s.views=data.views;
    for(let i=0;i<2;i++)s.projection[i].set(data.views[i].projection);
    s.orientation=s.yawOffset.clone().mul(new pc.Quat(c.orientation.x,c.orientation.y,c.orientation.z,c.orientation.w));
    const f=s.orientation.transformVector(pc.Vec3.FORWARD,new pc.Vec3());yaw=Math.atan2(-f.x,-f.z)*180/Math.PI;pitch=Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI;
    const clamp=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;move={x:clamp(data.x),z:clamp(data.z)};
    setKeys(new Set((data.keys||[]).filter(k=>Object.hasOwn(KEY,k))));lastInput=performance.now();
    const render=!reading&&(!ackPending||performance.now()-ackPending>1000);
    headCamera.camera.enabled=s.right.camera.enabled=render;loopApp.autoRender=render;
    // XR animation frames continue while ordinary window animation frames pause.
    // Drive Arcade updates from the headset clock, without a competing RAF loop.
    loopApp.tick(performance.now());return null;
  }
  function endStereo(resume=true){
    if(!stereo)return;const s=stereo;stereo=null;
    headCamera.camera.renderTarget=null;headCamera.camera.rect=s.rect;headCamera.camera.calculateProjection=s.calcProjection;headCamera.camera.enabled=true;
    s.right.destroy();target?.destroy();texture?.destroy();target=texture=null;
    captureContext?.unconfigure();captureContext=captureCanvas=null;settings=s.previous;ackPending=0;
    loopApp.requestAnimationFrame=s.requestAnimationFrame;loopApp.autoRender=s.autoRender;
    release();if(resume)loopApp.requestAnimationFrame();
  }
  async function readFrame(){
    if(!connected)return;
    const now=performance.now();renderCount++;if(lastRender){renderIntervals.push(now-lastRender);if(renderIntervals.length>120)renderIntervals.shift();}lastRender=now;
    if(now-lastState>200){lastState=now;send({type:'state',state:status()});}
    if(settings.transport==='webrtc'||settings.transport==='direct'||(settings.mode==='compare'&&!headCamera.camera.enabled))return;
    if(reading||now-lastRead<1000/settings.fps-2||(ackPending&&now-ackPending<1000))return;
    reading=true;lastRead=now;const tex=texture,rt=target,camera=headCamera;
    try{
      if(settings.transport==='bitmap'){
        let canvas=loopApp.graphicsDevice.canvas;
        if(settings.mode==='compare'||settings.mode==='stereo'){
          const device=loopApp.graphicsDevice.wgpu,encoder=device.createCommandEncoder();
          encoder.copyTextureToTexture({texture:texture.impl.gpuTexture},{texture:captureContext.getCurrentTexture()},{width:settings.width,height:settings.height,depthOrArrayLayers:1});
          device.queue.submit([encoder.finish()]);canvas=captureCanvas;
        }
        const bitmap=await createImageBitmap(canvas);
        if(!connected||headCamera!==camera){bitmap.close();return;}
        frameCount++;ackPending=performance.now();send({type:'bitmap',id:++captureId,width:bitmap.width,height:bitmap.height,bitmap},[bitmap]);
      }else{
        const pixels=await tex.read(0,0,settings.width,settings.height,{renderTarget:rt,immediate:true});
        if(!connected||texture!==tex)return;
        frameCount++;send({type:'frame',width:settings.width,height:settings.height,pixels:pixels.buffer,flipY:loopApp.graphicsDevice.deviceType==='webgl2',state:status()},[pixels.buffer]);
      }
      captureTimes.push(performance.now()-now);if(captureTimes.length>120)captureTimes.shift();
    }catch(e){streamError=String(e.message||e);send({type:'error',error:streamError});}finally{reading=false;}
  }
  function stop(){endStereo(false);release();restoreHead();restoreBody();restoreRendering();headApplied=null;connected=false;if(input&&source)input.removeSource(source);source=null;input=null;if(loopApp){loopApp.off('prerender',placeHead);loopApp.off('postrender',readFrame);if(originalFrameEnd&&loopApp.graphicsDevice.frameEnd===wrappedFrameEnd)loopApp.graphicsDevice.frameEnd=originalFrameEnd;originalFrameEnd=wrappedFrameEnd=null;loopApp.off('postrender',restoreHead);}xrRig?.destroy();xrRig=null;headCamera?.destroy();target?.destroy();texture?.destroy();headCamera=texture=target=null;owner=null;return status();}
  async function connect(ctx,payload={}){
    if(ctx.source!==window.parent||window.parent===window)throw Error('Connect from the outside wrapper.');
    const a=getApp(),pc=window.pc,p=player();if(!a||!pc||!p)throw Error('Start the game inside the embed first.');
    stop();owner=ctx;
    const dimensions={low:[960,540],balanced:[1280,720],sharp:[1920,1080],legacy:[640,360]};
    const quality=Object.hasOwn(dimensions,payload.quality)?payload.quality:'balanced';
    const transport=['bitmap','webrtc','direct','pixels'].includes(payload.transport)?payload.transport:'bitmap';
    settings={mode:payload.debug===true||transport==='pixels'?'compare':'first',transport,width:dimensions[quality][0],height:dimensions[quality][1],fps:transport==='pixels'?12:payload.debug===true?30:60,exposure:Number.isFinite(payload.exposure)?Math.max(.1,Math.min(2,payload.exposure)):1,tone:payload.tone==='aces'?'aces':'neutral'};
    input=getInput();if(!input)throw Error('Live input manager was not found.');
    source={id:'hackathon-outside-joystick',attach(){},detach(){},lastActivityAt:()=>Date.now(),
      readMove(out){const length=Math.max(1,Math.hypot(move.x,move.z));const h=yaw*Math.PI/180,m=(cameraLook()?.yaw||0)*Math.PI/180;
      const wx=Math.cos(h)*move.x+Math.sin(h)*move.z,wz=-Math.sin(h)*move.x+Math.cos(h)*move.z;
      out.x=(Math.cos(m)*wx-Math.sin(m)*wz)/length;out.z=(Math.sin(m)*wx+Math.cos(m)*wz)/length;return Math.abs(move.x)+Math.abs(move.z)>.001;},consumeLook(out){out.x=out.y=0;},consumeWheel:()=>0,isJump:()=>keys.has('Space'),isSprint:()=>keys.has('ShiftLeft'),isCrouch:()=>keys.has('KeyC'),isKeyPressed:()=>false,isCodePressed:code=>keys.has(code),readActions(out,bindings){for(const [name,codes]of Object.entries(bindings))if(codes.some(code=>keys.has(code)))out[name]=1;},releaseAll:release};
    input.addSource(source);
    // Seed eye direction from the character's +Z heading, not the orbit camera.
    const facing=p.getRotation().transformVector(new pc.Vec3(0,0,1),new pc.Vec3());yaw=Math.atan2(-facing.x,-facing.z)*180/Math.PI;pitch=0;
    loopApp=a;
    const main=window.gameManager.getViewCamera();const c=main.camera||main;
    {
      const gd=a.graphicsDevice;canvasSaved={mode:a._resolutionMode,width:gd.width,height:gd.height,ratio:gd.maxPixelRatio};exposureSaved=settings.mode==='first'?a.scene.exposure:null;
      gd.maxPixelRatio=1;a.setCanvasResolution(pc.RESOLUTION_FIXED,settings.width,settings.height);
    }
    if(settings.mode==='compare'){
      if(settings.transport==='bitmap'&&!a.graphicsDevice.wgpu){settings.transport='pixels';settings.fps=12;}
      texture=new pc.Texture(a.graphicsDevice,{name:'HackathonHeadFeed',width:settings.width,height:settings.height,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});
      target=new pc.RenderTarget({colorBuffer:texture,depth:true,samples:1});
      if(settings.transport==='bitmap'){
        captureCanvas=new OffscreenCanvas(settings.width,settings.height);captureContext=captureCanvas.getContext('webgpu');
        captureContext.configure({device:a.graphicsDevice.wgpu,format:'rgba8unorm',alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
      }
    }
    xrRig=new pc.Entity('HackathonXRPlayerOrigin');a.root.addChild(xrRig);headCamera=new pc.Entity('HackathonPlayerHeadCamera');xrRig.addChild(headCamera);xrEyeHeight=xrHeadHeight=null;
    headCamera.addComponent('camera',{clearColor:c.clearColor,clearColorBuffer:true,clearDepthBuffer:true,nearClip:.15,farClip:c.farClip||1000,fov:80,priority:100,layers:[...c.layers].filter(id=>id!==pc.LAYERID_UI),renderTarget:target});
    for(const key of ['aperture','shutter','sensitivity'])headCamera.camera[key]=c[key];
    headCamera.camera.toneMapping=settings.tone==='aces'?pc.TONEMAP_ACES:pc.TONEMAP_NEUTRAL;headCamera.camera.gammaCorrection=pc.GAMMA_SRGB;
    loopApp=a;trackedPlayer=null;head=null;headReference=null;avatarYaw=null;connected=true;bodyHidden=true;bodyHeadCulls=bodyOtherChecks=0;frameCount=0;lastRender=lastState=lastRead=lastScan=lastCameraScan=0;renderCount=0;renderIntervals=[];captureTimes=[];lastInput=performance.now();streamError=null;
    a.on('prerender',placeHead);a.on('postrender',restoreHead);
    // WebGPU submits its commands in frameEnd, after the postrender event.
    // Snapshot only after submission, while the canvas image is still valid.
    originalFrameEnd=a.graphicsDevice.frameEnd;wrappedFrameEnd=function(...args){const result=originalFrameEnd.apply(this,args);readFrame();return result;};a.graphicsDevice.frameEnd=wrappedFrameEnd;placeHead();
    const panel=document.querySelector('#arcade-vr-lab-panel');if(panel)panel.style.display='none';
    if(settings.transport==='webrtc')await startVideo();
    return{...status(),rtcOffer:peer?.localDescription?.toJSON()||null,movementBindings:input.getMovementBindings?.(),actionBindings:input.getActionBindings?.()};
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
    yaw=y;pitch=p;lastInput=performance.now();placeHead();return payload.brief?null:status();
  }
  window.__arcadeControls={ready:()=>connected&&gameReady(),execute:async(r,ctx)=>{
    if(r.op==='runtime.inspect')return inspect();
    if(r.op==='controls.connect')return connect(ctx,r.payload);
    if(r.op==='controls.status')return status();
    if(!connected||ctx.source!==owner?.source||ctx.origin!==owner?.origin)throw Error('Connect the outside controls first.');
    if(r.op==='controls.xr.start')return startStereo(r.payload||{});
    if(r.op==='controls.xr.pose')return updateStereo(r.payload||{});
    if(r.op==='controls.xr.end'){endStereo();return status();}
    if(r.op==='controls.frameAck'){if(r.payload?.id===captureId)ackPending=0;return null;}
    if(r.op==='controls.rtc'){
      const data=r.payload||{};if(!peer)throw Error('No video peer');
      if(data.sdp){await peer.setRemoteDescription(data.sdp);for(const candidate of rtcCandidates)await peer.addIceCandidate(candidate);rtcCandidates=[];}
      if(data.candidate){if(peer.remoteDescription)await peer.addIceCandidate(data.candidate);else rtcCandidates.push(data.candidate);}return null;
    }
    if(r.op==='controls.color'){const d=r.payload||{};if(Number.isFinite(d.exposure))settings.exposure=Math.max(.1,Math.min(2,d.exposure));if(['neutral','aces'].includes(d.tone))settings.tone=d.tone;headCamera.camera.toneMapping=settings.tone==='aces'?window.pc.TONEMAP_ACES:window.pc.TONEMAP_NEUTRAL;return status();}
    if(r.op==='controls.stop'){if(loopApp?.xr?.active)await new Promise((resolve,reject)=>loopApp.xr.end(e=>e?reject(e):resolve()));return stop();}
    if(r.op==='controls.body'){bodyHidden=r.payload?.visible!==true;return status();}
    if(r.op==='controls.look')return applyLook(r.payload||{});
    if(r.op==='controls.input'){
      if(loopApp?.xr?.active||stereo)return null;
      const d=r.payload||{},finite=(n,limit)=>Number.isFinite(n)?Math.max(-limit,Math.min(limit,n)):0;
      move={x:finite(d.x,1),z:finite(d.z,1)};lastInput=performance.now();
      setKeys(new Set((Array.isArray(d.keys)?d.keys:[]).filter(k=>Object.hasOwn(KEY,k))));return null;
    }
    throw Error('Unsupported control operation '+r.op);
  }};
  window.addEventListener('pagehide',stop);
})();
