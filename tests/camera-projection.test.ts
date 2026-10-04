import { expect, test } from 'vitest';
import { ASPECT_MANUAL, Camera, Mat4, Vec3, VIEW_CENTER } from 'playcanvas';
import type { CameraComponent, GraphicsDevice } from 'playcanvas';
import { setCameraProjection } from '../src/client/camera-projection.js';
import { guardProjection } from '../src/client/tracking.js';
function renderLens(camera: Camera): { scene: Mat4; sky: Mat4 } {
  camera.aspectRatioMode = ASPECT_MANUAL;
  const scene = camera.projectionMatrix;
  camera.calculateProjection?.(scene, VIEW_CENTER);
  return { scene, sky: camera.getProjectionMatrixSkybox() };
}
function component(camera: Camera): CameraComponent {
  return { camera, set calculateProjection(callback: Camera['calculateProjection']) { camera.calculateProjection = callback; } } as CameraComponent;
}
test('reproduces the separate default sky lens and synchronizes asymmetric guarded eye projections', () => {
  const camera = new Camera({} as GraphicsDevice); camera.fov = 80; camera.aspectRatio = 2;
  const projection = new Mat4().setPerspective(95, 1, .05, 1000); projection.data[8] = .12; projection.data[9] = -.08;
  const capture = new Mat4().set(guardProjection(Array.from(projection.data)));
  camera.calculateProjection = (matrix: Mat4) => matrix.copy(capture);
  const broken = renderLens(camera); expect(Array.from(broken.sky.data)).not.toEqual(Array.from(broken.scene.data));
  setCameraProjection(component(camera), capture);
  for (const aspect of [1, 2, .8]) { camera.aspectRatio = aspect; const lens = renderLens(camera); expect(Array.from(lens.sky.data)).toEqual(Array.from(lens.scene.data)); expect(Array.from(lens.sky.data)).toEqual(Array.from(capture.data)); }
});
test('sky and geometry reconstruct the same world direction through head yaw, pitch and roll', () => {
  const camera = new Camera({} as GraphicsDevice), projection = new Mat4().setPerspective(80, .9, .05, 1000);
  setCameraProjection(component(camera), projection);
  for (const rotation of [[0,0,0],[25,70,10],[-40,-110,-15]]) {
    camera.fov = 50; const lens = renderLens(camera), clip = new Vec3(.6,.2,1), world = new Mat4().setFromEulerAngles(...rotation as [number,number,number]);
    const sky = world.transformVector(lens.sky.clone().invert().transformPoint(clip)).normalize(), scene = world.transformVector(lens.scene.clone().invert().transformPoint(clip)).normalize();
    expect(sky.x).toBeCloseTo(scene.x,6); expect(sky.y).toBeCloseTo(scene.y,6); expect(sky.z).toBeCloseTo(scene.z,6);
  }
});
