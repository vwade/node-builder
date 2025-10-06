import { beforeEach, describe, expect, it } from 'vitest';
import { gen_id, peek_id, reset_ids } from '../src/core/id.js';

describe('id generator', () => {
	beforeEach(() => {
		reset_ids();
	});

	it('increments per prefix deterministically', () => {
		expect(gen_id('n')).toBe('n_1');
		expect(gen_id('n')).toBe('n_2');
	});

	it('isolates counters across prefixes', () => {
		expect(gen_id('n')).toBe('n_1');
		expect(gen_id('e')).toBe('e_1');
		expect(gen_id('n')).toBe('n_2');
		expect(gen_id('e')).toBe('e_2');
	});

	it('peek does not advance the counter', () => {
		expect(peek_id('n')).toBe('n_1');
		expect(gen_id('n')).toBe('n_1');
		expect(peek_id('n')).toBe('n_2');
	});
});
