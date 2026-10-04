import { describe, expect, it, vi } from 'vitest';
import { Feedback, InteractionPulse } from '../src/client/feedback.js';
describe('optional feedback and actions', () => {
  it('keeps UI selection separate from gameplay and releases pulses', () => { const input = new InteractionPulse(); input.select(true, 100); expect(input.keys(100)).toEqual([]); input.select(false, 100); expect(input.keys(120)).toEqual(['KeyE']); expect(input.keys(181)).toEqual([]); input.select(false, 200); input.clear(); expect(input.keys(201)).toEqual([]); });
  it('bounds haptics, handles missing APIs and throttles bursts', async () => { const pulse = vi.fn(async () => true), output = { pulse }, feedback = new Feedback(); feedback.pulse(undefined, 0); feedback.pulse(output, 0); feedback.pulse(output, 1); expect(pulse).toHaveBeenCalledTimes(1); expect(pulse).toHaveBeenCalledWith(.25, 25); await new Promise(resolve => setTimeout(resolve, 0)); feedback.pulse(output, 50); expect(pulse).toHaveBeenCalledTimes(1); feedback.pulse(output, 101); expect(pulse).toHaveBeenCalledTimes(2); });
});
