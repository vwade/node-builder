import { describe, expect, it } from 'vitest';
import * as NovaNode from '../src/index.js';

describe('public exports', () => {
	it('exposes the react node layer helpers', () => {
		expect(NovaNode.Graph_node_layer).toBeTypeOf('function');
		expect(NovaNode.compute_drag_positions).toBeTypeOf('function');
	});
});
