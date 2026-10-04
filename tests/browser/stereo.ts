import * as pc from 'playcanvas';
import { WorldUI } from '../../src/client/world-ui.js';
import { EngineController } from '../../src/client/engine.js';
import type { EngineApplication, InputSource } from '../../src/client/globals.js';
import type { XRPacket } from '../../src/shared/protocol.js';
/** Exercise the real GPU capture bridge without claiming a simulated headset is hardware validation. */
export async function verifyStereo(): Promise<Record<string, unknown>> {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540; canvas.dataset.arcadeVrEngine = 'true'; document.body.append(canvas);
  const device = await pc.createGraphicsDevice(canvas, { deviceTypes: ['webgpu'], glslangUrl: '/libs/glslang.js', twgslUrl: '/libs/twgsl.js' });
  if (device.deviceType !== 'webgpu') { device.destroy(); canvas.remove(); throw Error('Actual WebGPU required for this fixture'); }
  const application = new pc.Application(canvas, { graphicsDevice: device }), sources = new Set<InputSource>(), engine = new EngineController();
  const nativeAnimation = (application as EngineApplication).requestAnimationFrame;
  let material: pc.StandardMaterial | undefined, sky: pc.Texture | undefined, panel: WorldUI | undefined;
  try {
    sky = new pc.Texture(device, { name: 'world-fixed-sky-probe', width: 4, height: 4, cubemap: true, mipmaps: false, format: pc.PIXELFORMAT_RGBA8, levels: [Array.from({length:6}, (_,face) => { const data = new Uint8Array(64); for (let i = 0; i < 64; i += 4) data.set([0,60 + face * 20,180,255],i); return data; })] }); application.scene.skybox = sky;
    const actor = new pc.Entity('player'); actor.setPosition(0, .9, 0); actor.setEulerAngles(0, 180, 0); application.root.addChild(actor);
    const headBone = new pc.Entity('mixamorig:Head'); headBone.setLocalPosition(0, .72, 0); actor.addChild(headBone); for (const side of ['Left', 'Right']) { const foot = new pc.Entity('mixamorig:' + side + 'Foot'); foot.setLocalPosition(side === 'Left' ? -.15 : .15, -.9, 0); actor.addChild(foot); }
    const camera = new pc.Entity('main-camera'); camera.addComponent('camera', { clearColor: new pc.Color(0, 0, 0, 1) }); application.root.addChild(camera);
    const light = new pc.Entity('shadow-budget-probe'); light.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 2048 }); application.root.addChild(light);
    const cube = new pc.Entity('red-target'); cube.addComponent('render', { type: 'box' }); cube.setPosition(0, 1.7, -2); cube.setLocalScale(.4, .4, .4); application.root.addChild(cube);
    material = new pc.StandardMaterial(); material.useLighting = false; material.diffuse.set(0, 0, 0); material.emissive.set(.5, 0, 0); material.update(); if (cube.render) cube.render.material = material;
    const screen = new pc.Entity('screen'); screen.addComponent('screen', { screenSpace: true, resolution: new pc.Vec2(1920, 1080), referenceResolution: new pc.Vec2(1920, 1080) }); application.root.addChild(screen);
    const hud = new pc.Entity('hud-button'); hud.addComponent('element', { type: 'image', anchor: new pc.Vec4(.45, .45, .55, .55), pivot: new pc.Vec2(.5, .5), color: new pc.Color(1, 1, 0), opacity: .5 }); screen.addChild(hud);
    window.pc = pc; window.pcApp = application as EngineApplication; window.gameManager = { getApp: () => application as EngineApplication, getViewCamera: () => camera, getPlayerControlService: () => ({ controlledEntity: actor, getPlayRigController: () => ({ getInputManager: () => ({ addSource: source => { sources.add(source); }, removeSource: source => { sources.delete(source); } }) }) }) };
    application.start();
    const desktop = await new Promise<{ hudBothEyes: boolean; eyeCameras: number }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Desktop stereo preview timed out')), 20000);
      engine.onFrame = (bitmap, id) => { const probe = new OffscreenCanvas(960, 540), ctx = probe.getContext('2d', { willReadFrequently: true }); ctx?.drawImage(bitmap, 0, 0); const green = [240, 720].map(x => ctx?.getImageData(x, 270, 1, 1).data[1] || 0); bitmap.close(); engine.acknowledge(id); clearTimeout(timeout); resolve({ hudBothEyes: green.every(value => value > 100 && value < 160), eyeCameras: application.root.findComponents('camera').filter(component => component.entity.name.startsWith('ArcadeVRPreview') || component.entity.name === 'ArcadeVRPlayerCamera').length }); };
      engine.connect({ debug: true, width: 960, height: 540, fps: 30, tone: 'neutral', exposure: 1 });
    });
    engine.onFrame = (bitmap, id) => { bitmap.close(); engine.acknowledge(id); };
    const projection = Array.from(new pc.Mat4().setPerspective(90, 1, .05, 1000).data), orientation = { x: 0, y: 0, z: 0, w: 1 }, center = { position: { x: 0, y: 1.7, z: 0 }, orientation };
    const packet: XRPacket = { frameId: 1, time: performance.now(), center, views: (['left', 'right'] as const).map((eye, index) => ({ eye, position: { x: index ? .032 : -.032, y: 1.7, z: 0 }, orientation, projection, viewport: { x: index * 320, y: 0, width: 320, height: 320 } })), hands: [], keys: [], move: { x: 0, z: 0 } };
    const pixels = document.createElement('canvas'); pixels.width = 640; pixels.height = 320; const context = pixels.getContext('2d', { willReadFrequently: true }); if (!context) throw Error('Probe canvas unavailable');
    const panelCanvas = document.createElement('canvas'); panelCanvas.width = 640; panelCanvas.height = 360; const gl = panelCanvas.getContext('webgl2', { alpha: false, antialias: false }); if (!gl) throw Error('UI compositor unavailable');
    const ui = panel = new WorldUI(gl, () => {}, false); ui.anchor(center);
    let hudAlpha = 0, hudCornerAlpha = 255;
    engine.onUIFrame = bitmap => { const probe = document.createElement('canvas'); probe.width = 192; probe.height = 108; const ctx = probe.getContext('2d', { willReadFrequently: true }); ctx?.drawImage(bitmap, 0, 0, 192, 108); hudAlpha = ctx?.getImageData(96, 54, 1, 1).data[3] || 0; hudCornerAlpha = ctx?.getImageData(1, 1, 1, 1).data[3] || 0; ui.setEngineBitmap(bitmap); };
    const captured = new Promise<{ width: number; height: number; metadata: boolean }>((resolve, reject) => { const timer = setTimeout(() => reject(Error('GPU capture timed out')), 20000); engine.onXRFrame = (bitmap, metadata) => { clearTimeout(timer); context.drawImage(bitmap, 0, 0); resolve({ width: bitmap.width, height: bitmap.height, metadata: metadata === packet }); bitmap.close(); }; });
    let renders = 0; const countRender = () => { renders++; }; application.on('prerender', countRender);
    engine.renderXR(packet, { width: 320, height: 320 }); for (let i = 0; i < 10; i++) engine.renderXR(packet, { width: 320, height: 320 }); const frame = await captured; application.off('prerender', countRender); const singleFlight = renders === 1, reducedShadows = light.light?.shadowResolution === 512;
    gl.viewport(0, 0, 640, 360); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); ui.draw(new pc.Mat4().setPerspective(90, 16 / 9, .05, 100).data, new pc.Mat4().setTranslate(0, -1.7, 0).data, center); const blended = new Uint8Array(4); gl.readPixels(320, 171, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, blended); ui.destroy(); panel = undefined;
    const data = context.getImageData(0, 0, 640, 320).data, count = [0, 0], sum = [0, 0];
    for (let y = 0; y < 320; y++) for (let x = 0; x < 640; x++) { const index = (y * 640 + x) * 4; if ((data[index] || 0) > 80 && (data[index] || 0) > (data[index + 1] || 0) + 30 && (data[index] || 0) > (data[index + 2] || 0) + 30) { const eye = x < 320 ? 0 : 1; count[eye] = (count[eye] || 0) + 1; sum[eye] = (sum[eye] || 0) + x % 320; } }
    const color = Array.from(data.slice((160 * 640 + 160) * 4, (160 * 640 + 160) * 4 + 4));
    const srgb = Math.abs((color[0] || 0) - 128) < 8 && (color[1] || 0) < 8 && (color[2] || 0) < 8;
    const disparity = (sum[0] || 0) / Math.max(1, count[0] || 0) - (sum[1] || 0) / Math.max(1, count[1] || 0);
    const skyRendered = (data[1] || 0) > 20 && (data[2] || 0) > 20;
    const skyLensMatches = (application.root.findComponents('camera') as pc.CameraComponent[]).filter(camera => ['ArcadeVRPlayerCamera','ArcadeVRRightEye'].includes(camera.entity.name)).every(camera => Array.from(camera.camera.getProjectionMatrixSkybox().data).every((value,index) => Math.abs(value - (projection[index] || 0)) < .00001));
    engine.endXR(); engine.stop(); const restored = light.light?.shadowResolution === 2048 && (application as EngineApplication).requestAnimationFrame === nativeAnimation && sources.size === 0 && camera.camera?.enabled === true && device.width === 960 && device.height === 540;
    return { skyRendered, skyLensMatches, singleFlight, reducedShadows, ...frame, desktop, coloredPixels: count, centerRGBA: color, srgb, disparity, hudAlpha, hudCornerAlpha, blendedHUD: Array.from(blended), restored, verdict: skyRendered && skyLensMatches && desktop.hudBothEyes && desktop.eyeCameras === 2 && frame.width === 640 && frame.height === 320 && singleFlight && reducedShadows && frame.metadata && srgb && (count[0] || 0) > 100 && (count[1] || 0) > 100 && disparity > 5 && disparity < 7 && hudAlpha > 100 && hudAlpha < 160 && (blended[0] || 0) > 100 && (blended[0] || 0) < 160 && hudCornerAlpha < 10 && restored ? 'pass' : 'fail' };
  } finally { panel?.destroy(); engine.stop(); application.destroy(); material?.destroy(); sky?.destroy(); canvas.remove(); window.pcApp = undefined; window.gameManager = undefined; }
}
