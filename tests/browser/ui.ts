import * as pc from 'playcanvas';
import { WorldUI } from '../../src/client/world-ui.js';
import { createStereoProgram } from '../../src/client/xr-presenter.js';
window.pc = pc;
const canvas = document.querySelector<HTMLCanvasElement>('canvas'), run = document.querySelector<HTMLButtonElement>('#run'), output = document.querySelector<HTMLElement>('output'), action = document.querySelector<HTMLButtonElement>('#action');
if (!canvas || !run || !output || !action) throw Error('Fixture missing');
let clicks = 0; action.onclick = () => { clicks++; action.textContent = 'Clicked ' + clicks; };
run.onclick = async () => {
  clicks = 0; action.textContent = 'Interact';
  try {
    const gl = canvas.getContext('webgl2'); if (!gl) throw Error('WebGL2 unavailable');
    const stereo = createStereoProgram(gl); gl.deleteProgram(stereo);
    const ui = new WorldUI(gl, message => { output.textContent = message; });
    const orientation = { x: 0, y: 0, z: 0, w: 1 }, head = { position: { x: 0, y: 1.6, z: 0 }, orientation }; ui.anchor(head); ui.update(1000);
    const projection = new pc.Mat4().setPerspective(80, 16 / 9, .05, 100), view = new pc.Mat4().setTranslate(-head.position.x, -head.position.y, -head.position.z);
    await new Promise<void>(resolve => { let attempts = 0; const frame = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(.08, .12, .16, 1); gl.clear(gl.COLOR_BUFFER_BIT); ui.draw(projection.data, view.data, head); if (++attempts < 60) requestAnimationFrame(frame); else resolve(); }; requestAnimationFrame(frame); });
    const hit = ui.click({ position: { x: 0, y: 1.5, z: 0 }, orientation }); ui.destroy();
    output.textContent = JSON.stringify({ stereoShader: 'compiled', panelShader: 'compiled', rayHit: hit, buttonClicks: clicks, verdict: hit && clicks === 1 ? 'pass' : 'fail' });
  } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
};

import { verifyStereo } from './stereo.js';
const stereoRun = document.querySelector<HTMLButtonElement>('#stereo-run'); if (!stereoRun) throw Error('Stereo button missing');
stereoRun.onclick = () => { stereoRun.disabled = true; run.disabled = true; output.textContent = 'Checking actual WebGPU stereo capture…'; void verifyStereo().then(result => { output.textContent = JSON.stringify(result); }).catch(error => { output.textContent = String(error); }).finally(() => { stereoRun.disabled = false; run.disabled = false; }); };
