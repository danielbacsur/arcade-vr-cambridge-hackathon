(() => {
  'use strict';
  const config=window.ARCADE_PROXY,editor=config?.editor;if(!editor)return;
  const mapped=value=>{try{const url=new URL(value,location.href),origin=config.origins?.[url.hostname];return origin?origin+url.pathname+url.search+url.hash:value;}catch{return value;}};
  const fetch=window.fetch;window.fetch=function(input,init){if(input instanceof Request){const url=mapped(input.url);return fetch.call(this,url===input.url?input:new Request(url,input),init);}return fetch.call(this,mapped(String(input)),init);};
  const xhrOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){return xhrOpen.call(this,method,mapped(String(url)),...args);};
  function localGame(value){try{const u=new URL(value,location.href);if((u.hostname==='editor.joinarcade.ai'||u.origin===editor)&&/^\/play\/[a-f0-9-]{36}\/?$/.test(u.pathname))return editor+u.pathname+u.search+u.hash;}catch{}return null;}
  const open=window.open;
  window.open=function(url,...args){
    const popup=open.call(this,localGame(url)||mapped(url),...args);if(!popup)return popup;
    // Arcade opens a blank tab synchronously, then assigns its URL after an API
    // request. Preserve that flow while mapping the later location assignment.
    const localLocation=new Proxy(popup.location,{get(target,key){if(key==='assign'||key==='replace')return value=>target[key](localGame(value)||mapped(value));const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){return Reflect.set(target,key,key==='href'?(localGame(value)||mapped(value)):value,target);}});
    return new Proxy(popup,{get(target,key){if(key==='location')return localLocation;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){if(key==='location'){target.location=localGame(value)||mapped(value);return true;}return Reflect.set(target,key,value,target);}});
  };
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(a){const game=localGame(a.href);a.href=game||mapped(a.href);}},true);
  const scan=()=>{for(const frame of document.querySelectorAll('iframe[src]')){const game=localGame(frame.src);if(game&&frame.src!==game){frame.allow+='; xr-spatial-tracking; gamepad';frame.src=game;}}};
  document.addEventListener('DOMContentLoaded',()=>{scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});});
})();
