(() => {
  'use strict';
  if(!['www.tryarcade.com','site.localhost'].includes(location.hostname)||window.parent===window||window.__arcadeSiteBridge)return;
  window.__arcadeSiteBridge=true;
  const CHANNEL='arcade-site-shell-v1',allowed=new Set(['http://localhost','http://localhost:8765','http://editor.localhost','http://editor.localhost:8765']);
  let parentOrigin=null,lastRoute='';
  function send(data){if(parentOrigin)window.parent.postMessage({channel:CHANNEL,...data},parentOrigin);}
  function route(){const path=location.pathname+location.search+location.hash;if(path!==lastRoute){lastRoute=path;send({type:'route',path,title:document.title});}}
  function play(value){try{const u=new URL(value,location.href);if(parentOrigin&&u.origin==='https://editor.joinarcade.ai'&&/^\/play\/[a-f0-9-]{36}\/?$/.test(u.pathname)){send({type:'play',url:u.href});return true;}}catch{}return false;}
  window.addEventListener('message',e=>{if(e.source!==window.parent||!allowed.has(e.origin)||e.data?.channel!==CHANNEL||e.data.type!=='init')return;parentOrigin=e.origin;lastRoute='';route();});
  const open=window.open;window.open=function(url,...args){if(play(url))return null;return open.call(this,url,...args);};
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(a&&play(a.href)){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('popstate',route);window.addEventListener('hashchange',route);setInterval(route,300);
  try{const origin=new URL(document.referrer).origin;if(allowed.has(origin)){parentOrigin=origin;send({type:'ready'});route();}}catch{}
})();
