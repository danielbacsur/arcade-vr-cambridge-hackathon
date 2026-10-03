export const CHANNEL = 'arcade-vr-v2';
export interface Vector3 { x: number; y: number; z: number }
export interface Quaternion { x: number; y: number; z: number; w: number }
export interface Pose { position: Vector3; orientation: Quaternion }
export interface EyePose extends Pose { eye: 'left' | 'right'; projection: number[]; viewport: { x: number; y: number; width: number; height: number } }
export interface HandPose { side: 'left' | 'right'; grip?: Pose; joints?: Partial<Record<XRHandJoint, Pose>>; pinch: number; trigger: number }
export interface XRPacket { frameId: number; time: number; center: Pose; views: EyePose[]; hands: HandPose[]; move: { x: number; z: number }; keys: string[] }
export interface RenderSettings { debug: boolean; width: number; height: number; fps: number; tone: 'neutral' | 'aces'; exposure: number }
export interface RuntimeState { connected: boolean; ready: boolean; backend: string; player: { name: string; position: Vector3 } | null; look: { yaw: number; pitch: number }; camera: Vector3 | null; frames: number; renderFPS: number; captureFPS: number; captureMs: number; dimensions: { width: number; height: number }; xr: { active: boolean; supported: boolean; mode: string; ui: string; hands: number }; error: string | null }
export interface ProxyBoot { origins: Record<string, string>; runtime: string; wrapper: string; role: string; websocketProxy: boolean; websocketOrigins?: Record<string, string> }
export interface RequestMessage { channel: typeof CHANNEL; direction: 'request'; id: string; session?: string; op: string; payload?: unknown }
export interface ResponseMessage { channel: typeof CHANNEL; direction: 'response'; id: string; session: string; ok: boolean; result?: unknown; error?: string }
export interface StreamMessage { channel: typeof CHANNEL; direction: 'stream'; session: string; type: 'state' | 'bitmap' | 'error'; state?: RuntimeState; bitmap?: ImageBitmap; width?: number; height?: number; id?: number; error?: string }
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function finite(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
export function isPose(value: unknown): value is Pose {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.orientation)) return false;
  return ['x', 'y', 'z'].every(key => typeof value.position === 'object' && value.position !== null && Number.isFinite((value.position as Record<string, unknown>)[key])) && ['x', 'y', 'z', 'w'].every(key => Number.isFinite((value.orientation as Record<string, unknown>)[key]));
}
