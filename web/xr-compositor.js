'use strict';
// Arcade retains its WebGPU shaders. WebXR receives the two eye images through
// a separate WebGL layer on browsers without WebGPU/XR binding support.
window.createArcadeXRBridge=({request,send,onState})=>{
  let session=null,space=null,gl=null,layer=null,texture=null,program=null,canvas=null,buffer=null,hasFrame=false,starting=false,stopped=false;
  const bridge={get active(){return !!session;},get starting(){return starting;},upload(bitmap){
    if(!gl||stopped)return;
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);hasFrame=true;
  },async start(){
    if(session||starting)return;starting=true;stopped=false;onState('Opening VR…');
    try{
      // requestSession must run directly in the button's activation handler.
      session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      session.addEventListener('end',cleanup,{once:true});
      canvas=document.createElement('canvas');gl=canvas.getContext('webgl2',{xrCompatible:true,alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
      if(!gl)throw Error('The headset could not create its VR display.');
      await gl.makeXRCompatible();layer=new XRWebGLLayer(session,gl,{alpha:false,antialias:false,depth:false,framebufferScaleFactor:1});
      session.updateRenderState({baseLayer:layer,depthNear:.15,depthFar:1000});space=await session.requestReferenceSpace('local-floor');
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      const vertex=shader(gl.VERTEX_SHADER,'#version 300 es\nin vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}');
      const fragment=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float;uniform sampler2D image;uniform float eye;in vec2 uv;out vec4 color;void main(){color=texture(image,vec2((uv.x+eye)*.5,1.-uv.y));}');
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const attribute=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const eyeWidth=Math.min(1536,Math.round(layer.framebufferWidth/2)),eyeHeight=Math.min(2048,layer.framebufferHeight);
      await request('controls.xr.start',{eyeWidth,eyeHeight});
      if(stopped)return;starting=false;onState('VR active');session.requestAnimationFrame(render);
    }catch(error){onState(error.message);if(session)await session.end().catch(()=>{});else cleanup();throw error;}
  },async end(){if(session)await session.end();}};
  const pack=t=>({position:{x:t.position.x,y:t.position.y,z:t.position.z},orientation:{x:t.orientation.x,y:t.orientation.y,z:t.orientation.z,w:t.orientation.w}});
  function render(time,frame){
    if(stopped||frame.session!==session)return;session.requestAnimationFrame(render);
    const pose=frame.getViewerPose(space);if(!pose||pose.views.length!==2)return;
    const sources=Array.from(session.inputSources),left=sources.find(s=>s.handedness==='left')?.gamepad,right=sources.find(s=>s.handedness==='right')?.gamepad;
    const axes=left?.axes||[],dead=n=>Math.abs(n||0)>.15?n:0,keys=[];
    for(const [pad,index,key]of [[right,4,'Space'],[right,5,'KeyR'],[left,4,'KeyQ'],[left,0,'KeyF'],[right,0,'KeyE'],[left,3,'ShiftLeft']])if(pad?.buttons[index]?.pressed)keys.push(key);
    const views=[...pose.views].sort((a,b)=>a.eye==='left'?-1:b.eye==='left'?1:0);
    send('controls.xr.pose',{center:pack(pose.transform),views:views.map(v=>({...pack(v.transform),projection:Array.from(v.projectionMatrix)})),x:dead(axes.length>=4?axes[2]:axes[0]),z:dead(axes.length>=4?axes[3]:axes[1]),keys});
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
    if(!hasFrame)return;gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
    for(let i=0;i<2;i++){const viewport=layer.getViewport(views[i]);gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);gl.uniform1f(gl.getUniformLocation(program,'eye'),i);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  }
  function cleanup(){
    if(stopped)return;stopped=true;starting=false;session=null;
    request('controls.xr.end').catch(()=>{});
    if(gl){gl.deleteTexture(texture);gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.getExtension('WEBGL_lose_context')?.loseContext();}
    gl=layer=texture=program=buffer=space=canvas=null;hasFrame=false;onState('Enter VR');
  }
  return bridge;
};
