import { describe, expect, it } from 'vitest';
import { QualityBudget } from '../src/client/quality-budget.js';
describe('optional quality budgeting', () => {
  it('reduces sustained expensive frames with a bounded floor and cooldown', () => { const budget = new QualityBudget(); for (let i = 0; i < 20; i++) budget.sample(30, 6000); expect(budget.scale).toBe(.9); for (let i = 0; i < 100; i++) budget.sample(30, 6001); expect(budget.scale).toBe(.9); for (let i = 1; i < 20; i++) budget.sample(30, 6000 + i * 5000); expect(budget.scale).toBe(.6); });
  it('recovers gradually and ignores invalid timing', () => { const budget = new QualityBudget(); for (let i = 0; i < 20; i++) budget.sample(30, 6000); for (let i = 0; i < 100; i++) budget.sample(5, 6001); budget.sample(5, 12000); expect(budget.scale).toBe(.95); expect(budget.sample(NaN, 20000)).toBe(.95); });
});
