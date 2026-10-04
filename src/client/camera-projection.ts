import type { CameraComponent, Mat4 } from 'playcanvas';
/** PlayCanvas keeps a separate sky lens which calculateProjection does not update. */
export function setCameraProjection(camera: CameraComponent, projection: Mat4): void {
  camera.calculateProjection = matrix => {
    matrix.copy(projection);
    // Update after default lens evaluation, before the renderer reads its sky matrix.
    camera.camera.getProjectionMatrixSkybox().copy(projection);
  };
}
