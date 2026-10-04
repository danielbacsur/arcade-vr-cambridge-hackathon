export interface PointerTarget { dispatchEvent(event: Event): boolean }
/** Match browser pointer/mouse ordering so the editor retains its native command and undo path. */
export function editorPointer(target: PointerTarget, kind: 'move' | 'down' | 'up', x: number, y: number, button = 0): void {
  const buttons = kind === 'up' ? 0 : button === 0 ? 1 : button === 1 ? 4 : 2;
  const options = { clientX: x, clientY: y, button, buttons, bubbles: true, cancelable: true };
  target.dispatchEvent(new PointerEvent('pointer' + kind, { ...options, pointerId: 100, pointerType: 'mouse', isPrimary: true }));
  target.dispatchEvent(new MouseEvent('mouse' + kind, options));
  if (kind === 'up' && button === 0) target.dispatchEvent(new MouseEvent('click', options));
}
