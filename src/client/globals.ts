import type * as PC from 'playcanvas';
import type { ProxyBoot, RuntimeState, RenderSettings } from '../shared/protocol.js';
export interface InputSource {
  id: string; attach(): void; detach(): void; lastActivityAt(): number;
  readMove(out: { x: number; z: number }): boolean; consumeLook(out: { x: number; y: number }): void;
  consumeWheel(): number; isJump(): boolean; isSprint(): boolean; isCrouch(): boolean;
  isKeyPressed(): boolean; isCodePressed(code: string): boolean;
  readActions(out: Record<string, number>, bindings: Record<string, string[]>): void; releaseAll(): void;
}
export interface InputManager { addSource(source: InputSource): void; removeSource(source: InputSource): void; getMovementBindings?(): Record<string, string[]>; getActionBindings?(): Record<string, string[]> }
export interface RigController { getInputManager?(): InputManager; inputManager?: InputManager }
export interface PlayerService { controlledEntity?: PC.Entity; getPlayRigController?(): RigController; getFpsController?(): RigController }
export interface GamePlugin { getLocalPlayerEntity?(): PC.Entity; playerEntity?: PC.Entity }
export type EngineApplication = PC.Application & { frameRequestId?: number; tick(time: number): void; requestAnimationFrame(): void; graphicsDevice: PC.GraphicsDevice & { wgpu?: GPUDevice; frameEnd(): void }; };
export interface GameManager {
  getApp?(): EngineApplication; getPlayerControlService?(): PlayerService; getGameLogicPlugin?(): GamePlugin;
  getLocalPlayerEntity?(): PC.Entity; getViewCamera?(): PC.Entity | PC.CameraComponent;
  getFPSController?(): RigController; playModeController?: { fpsController?: RigController };
}
export interface RuntimeAPI { status(): RuntimeState; connect(settings: RenderSettings): RuntimeState; input(data: { x: number; z: number; keys: string[] }): void; look(yaw: number, pitch: number): void; stop(): void }
declare global {
  interface Window { ARCADE_PROXY?: ProxyBoot; pc?: typeof PC; pcApp?: EngineApplication; gameManager?: GameManager; arcadeVR?: RuntimeAPI }
}
