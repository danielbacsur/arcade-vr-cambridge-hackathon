const position={x:0,y:1.6,z:0},euler={x:0,y:0,z:0};
const cameraEntity={name:'Fixture camera',enabled:true,children:[],parent:null,getGuid:()=> 'fixture-camera',getPosition:()=>({...position}),getEulerAngles:()=>({...euler}),setPosition:(x,y,z)=>{Object.assign(position,{x,y,z});render();},setEulerAngles:(x,y,z)=>{Object.assign(euler,{x,y,z});render();}};
cameraEntity.camera={entity:cameraEntity,enabled:true};
const root={name:'Fixture world',enabled:true,children:[cameraEntity],getGuid:()=> 'fixture-root',getPosition:()=>({x:0,y:0,z:0}),getEulerAngles:()=>({x:0,y:0,z:0}),findComponents:type=>type==='camera'?[cameraEntity.camera]:[]};cameraEntity.parent=root;
window.pc={version:'fixture-only'};window.pcApp={root,graphicsDevice:{deviceType:'fixture'},xr:{supported:false,isAvailable:()=>false}};
window.gameManager={getApp:()=>window.pcApp,getCamera:()=>cameraEntity,getViewCamera:()=>cameraEntity};
function render(){document.querySelector('#camera-state').textContent=JSON.stringify({position,euler},null,2);}render();
