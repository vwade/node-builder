export interface Placeholder_core_config {
	name: string;
}

export function create_placeholder(config: Placeholder_core_config): Placeholder_core_config {
	return { ...config };
}
