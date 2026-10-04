import * as pc from 'playcanvas';
import { WorldUI } from '../../src/client/world-ui.js';
import { createStereoProgram } from '../../src/client/xr-presenter.js';
import { rotate } from '../../src/client/tracking.js';
import type { Pose } from '../../src/shared/protocol.js';
window.pc = pc;
const canvas = document.querySelector<HTMLCanvasElement>('canvas'), run = document.querySelector<HTMLButtonElement>('#run'), output = document.querySelector<HTMLElement>('output'), action = document.querySelector<HTMLButtonElement>('#action');
if (!canvas || !run || !output || !action) throw Error('Fixture missing');
let clicks = 0; action.onclick = () => { clicks++; action.textContent = 'Clicked ' + clicks; };
run.onclick = async () => {
  clicks = 0; action.textContent = 'Interact';
  try {
    const gl = canvas.getContext('webgl2'); if (!gl) throw Error('WebGL2 unavailable');
    const stereo = createStereoProgram(gl); gl.deleteProgram(stereo);
    const ui = new WorldUI(gl, message => { output.textContent = message; }, true, () => {}, { width: 1920, height: 1080 }, { followHead: true, handControls: true });
    const orientation = { x: 0, y: 0, z: 0, w: 1 }, head = { position: { x: 0, y: 1.6, z: 0 }, orientation }; ui.anchor(head); ui.update(1000);
    const projection = new pc.Mat4().setPerspective(80, 16 / 9, .05, 100), view = new pc.Mat4().setTranslate(-head.position.x, -head.position.y, -head.position.z);
    await new Promise<void>(resolve => { let attempts = 0; const frame = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.08, .12, .16, 1); gl.clear(gl.COLOR_BUFFER_BIT); ui.draw(projection.data, view.data, head); if (++attempts < 60) requestAnimationFrame(frame); else resolve(); }; requestAnimationFrame(frame); });
    const rayAt = (x: number, y: number, head: Pose): Pose => { const offset = rotate(head.orientation, { x: (x / 1920 - .5) * 2.4, y: -.1 + (.5 - y / 1080) * 1.35, z: 0 }); return { position: { x: head.position.x + offset.x, y: head.position.y + offset.y, z: head.position.z + offset.z }, orientation: head.orientation }; };
    const turned = new pc.Quat().setFromEulerAngles(25, 60, 15), movedHead = { position: { x: 2, y: 1.7, z: 3 }, orientation: { x: turned.x, y: turned.y, z: turned.z, w: turned.w } }; ui.anchor(movedHead);
    const ray = rayAt(960, 540, movedHead), hit = ui.pointer(ray, 'down', 201); ui.pointer(ray, 'up', 201);
    const grabbed = ui.pointer(rayAt(180, 860, movedHead), 'down', 200); ui.pointer(rayAt(290, 860, movedHead), 'move', 200); const movement = { ...ui.movement() }; ui.pointer(undefined, 'move', 200); const lostRayStops = ui.movement().x === 0; ui.releasePointers(); ui.destroy();
    output.textContent = JSON.stringify({ stereoShader: 'compiled', panelShader: 'compiled', headLockedRayHit: hit, buttonClicks: clicks, grabbed, movement, lostRayStops, verdict: hit && clicks === 1 && grabbed && Math.abs(movement.x - 1) < .001 && lostRayStops ? 'pass' : 'fail' });
  } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
};

import { verifyStereo } from './stereo.js';
const stereoRun = document.querySelector<HTMLButtonElement>('#stereo-run'); if (!stereoRun) throw Error('Stereo button missing');
stereoRun.onclick = () => { stereoRun.disabled = true; run.disabled = true; output.textContent = 'Checking actual WebGPU stereo capture…'; void verifyStereo().then(result => { output.textContent = JSON.stringify(result); }).catch(error => { output.textContent = String(error); }).finally(() => { stereoRun.disabled = false; run.disabled = false; }); };
