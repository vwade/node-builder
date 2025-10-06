const counters = new Map<string, number>();

export function gen_id(prefix = 'id'): string {
	const counter = (counters.get(prefix) ?? 0) + 1;
	counters.set(prefix, counter);
	return `${prefix}_${counter.toString(36)}`;
}

export function peek_id(prefix = 'id'): string {
	const counter = (counters.get(prefix) ?? 0) + 1;
	return `${prefix}_${counter.toString(36)}`;
}

export function reset_ids(seed?: Record<string, number>): void {
	counters.clear();
	if (!seed) {
		return;
	}
	for (const [prefix, value] of Object.entries(seed)) {
		counters.set(prefix, value);
	}
}
