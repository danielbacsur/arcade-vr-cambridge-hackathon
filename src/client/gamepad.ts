export interface PadInput { x: number; z: number; yaw: number; pitch: number; keys: string[] }
function axis(value: number | undefined): number { if (!Number.isFinite(value) || Math.abs(value || 0) < .15) return 0; return Math.sign(value || 0) * (Math.min(1, Math.abs(value || 0)) - .15) / .85; }
export function gamepadInput(pad: Pick<Gamepad, 'axes' | 'buttons'> | null): PadInput {
  const x = axis(pad?.axes[0]), z = axis(pad?.axes[1]), length = Math.max(1, Math.hypot(x, z));
  return { x: x / length, z: z / length, yaw: axis(pad?.axes[2]), pitch: axis(pad?.axes[3]), keys: [[0, 'Space'], [1, 'KeyE'], [4, 'ShiftLeft']].filter(([index]) => pad?.buttons[Number(index)]?.pressed).map(([, code]) => String(code)) };
}
