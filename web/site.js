'use strict';
const site=document.querySelector('#arcade-site'),CHANNEL='arcade-site-shell-v1';
let SITE='https://www.tryarcade.com',ready=false;
function upstream(){return SITE+location.pathname+location.search+location.hash;}
function init(){site.contentWindow.postMessage({channel:CHANNEL,type:'init'},SITE);}
site.addEventListener('load',init);
window.addEventListener('message',e=>{
  if(e.source!==site.contentWindow||e.origin!==SITE||e.data?.channel!==CHANNEL)return;
  const d=e.data;if(d.type==='ready'){ready=true;init();return;}
  if(d.type==='route')ready=true;
  if(d.type==='route'&&typeof d.path==='string'&&d.path.startsWith('/')&&!d.path.startsWith('//')){
    const path=d.path;if(path!==location.pathname+location.search+location.hash)history.pushState(null,'',path);document.title=d.title||'Arcade';return;
  }
  if(d.type==='play'&&typeof d.url==='string'){
    const u=new URL(d.url);if(u.origin==='https://editor.joinarcade.ai'&&/^\/play\/[a-f0-9-]{36}\/?$/.test(u.pathname))location.assign(u.pathname+u.search+u.hash);
  }
});
window.addEventListener('popstate',()=>{site.src=upstream();});
function localSite(){const local=new URL(location.href);local.hostname='site.localhost';SITE=local.origin;site.src=upstream();}
(async()=>{const vr=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false);if(vr)localSite();else{site.src=upstream();setTimeout(()=>{if(!ready)localSite();},5000);}})();
