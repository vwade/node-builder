import { beforeEach, describe, expect, it } from 'vitest';
import { gen_id, peek_id, prime_ids, reset_ids } from '../src/core/id.js';

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

	it('primes counters to a provided value', () => {
		prime_ids({ n: 5, e: 2 });
		expect(gen_id('n')).toBe('n_6');
		expect(gen_id('e')).toBe('e_3');
	});
});
