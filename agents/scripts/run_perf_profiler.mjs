import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';

const DEFAULT_SCENARIO = path.resolve('agents/scenarios/large-graph.ts');
const PROJECT_ROOT = path.resolve('.');

function parse_cli_args(argv) {
	const args = { scenario: DEFAULT_SCENARIO, headless: true };
	for (let index = 2; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--scenario' && index + 1 < argv.length) {
			args.scenario = path.resolve(argv[index + 1]);
			index += 1;
			continue;
		}
		if (token === '--no-headless') {
			args.headless = false;
			continue;
		}
		if (token === '--artifact-root' && index + 1 < argv.length) {
			args.artifact_root = path.resolve(argv[index + 1]);
			index += 1;
			continue;
		}
		console.warn(`[perf-profiler] ignoring unknown flag: ${token}`);
	}
	return args;
}

function ensure_number(value, name) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new Error(`Scenario is missing numeric field: ${name}`);
	}
	return value;
}

function percentile(values, rank) {
	if (!values.length) {
		return Number.NaN;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1));
	return sorted[index];
}

async function sample_frame_times(page, warmup_ms, duration_ms) {
	if (warmup_ms > 0) {
		await page.waitForTimeout(warmup_ms);
	}
	return page.evaluate(({ duration }) => {
		return new Promise((resolve) => {
			const frames = [];
			let last = performance.now();
			const end = last + duration;
			const step = (now) => {
				frames.push(now - last);
				last = now;
				if (now >= end) {
					resolve(frames);
					return;
				}
				requestAnimationFrame(step);
			};
			requestAnimationFrame((initial) => {
				last = initial;
				requestAnimationFrame(step);
			});
		});
	}, { duration: duration_ms });
}

async function bundle_scenario(entry_path, bundle_path, scenario_path) {
	const entry_source = `import React, { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import scenarioModule from ${JSON.stringify(scenario_path)};
import { Graph_canvas } from ${JSON.stringify(path.resolve('src/react/canvas.tsx'))};
import { Graph_node_layer } from ${JSON.stringify(path.resolve('src/react/nodes.tsx'))};
import type { Node } from ${JSON.stringify(path.resolve('src/core/types.ts'))};

const scenario = scenarioModule.default ?? scenarioModule;
const nodes: Node[] = scenario.generate_nodes();

window.__PERF_METADATA__ = {
	id: scenario.id,
	label: scenario.label,
	description: scenario.description,
	viewport: scenario.viewport,
	sampling: scenario.sampling,
	frame_budget: scenario.frame_budget,
	node_dimensions: scenario.node_dimensions,
	node_count: nodes.length,
};

function Perf_app() {
	const graph_nodes = useMemo(() => nodes, []);
	const container_style: React.CSSProperties = {
		width: '100vw',
		height: '100vh',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		background: '#0f172a',
	};
	const shell_style: React.CSSProperties = {
		width: scenario.viewport.width,
		height: scenario.viewport.height,
		borderRadius: 24,
		overflow: 'hidden',
		boxShadow: '0 28px 80px rgba(15, 23, 42, 0.35)',
		background: '#f8fafc',
	};
	return (
		<div style={container_style}>
			<div style={shell_style}>
				<Graph_canvas
					className=\"perf-canvas\"
					style={{ width: '100%', height: '100%' }}
					initial_camera={{ x: 0, y: 0, scale: 0.5 }}
				>
					<Graph_node_layer
						nodes={graph_nodes}
						default_width={scenario.node_dimensions.width}
						default_height={scenario.node_dimensions.height}
					/>
				</Graph_canvas>
			</div>
		</div>
	);
}

const container = document.getElementById('root');
if (!container) {
	throw new Error('Missing root container');
}
const root = createRoot(container);
root.render(
	<StrictMode>
		<Perf_app />
	</StrictMode>,
);
window.__PERF_READY__ = true;
`;
	await fs.writeFile(entry_path, entry_source, 'utf8');
	await esbuild.build({
		absWorkingDir: PROJECT_ROOT,
		entryPoints: [entry_path],
		bundle: true,
		format: 'iife',
		platform: 'browser',
		outfile: bundle_path,
		target: ['chrome110'],
		jsxFactory: 'React.createElement',
		jsxFragment: 'React.Fragment',
		loader: {
			'.ts': 'ts',
			'.tsx': 'tsx',
		},
	});
}

async function compile_scenario_module(scenario_path, out_path) {
	await esbuild.build({
		absWorkingDir: PROJECT_ROOT,
		entryPoints: [scenario_path],
		bundle: true,
		format: 'esm',
		platform: 'neutral',
		outfile: out_path,
		target: ['es2020'],
		loader: {
			'.ts': 'ts',
		},
	});
	return import(pathToFileURL(out_path).href);
}

async function ensure_directory(dir) {
	await fs.mkdir(dir, { recursive: true });
}

function create_timestamp() {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

function format_metric_row(label, value, budget, ok) {
	const emoji = ok ? '✅' : '❌';
	return `| ${label} | ${value.toFixed(2)} | ${budget.toFixed(2)} | ${emoji} |`;
}

async function main() {
	const args = parse_cli_args(process.argv);
	const scenario_path = args.scenario;
	try {
		await fs.access(scenario_path);
	} catch (error) {
		console.error(`[perf-profiler] scenario not found: ${scenario_path}`);
		throw error;
	}
	const temp_dir = await fs.mkdtemp(path.join(PROJECT_ROOT, '.perf-profiler-'));
	try {
		const entry_path = path.join(temp_dir, 'entry.tsx');
		const bundle_path = path.join(temp_dir, 'bundle.js');
		const scenario_module_path = path.join(temp_dir, 'scenario.mjs');
		const scenario_exports = await compile_scenario_module(scenario_path, scenario_module_path);
		const scenario = scenario_exports.default ?? scenario_exports.scenario;
		if (!scenario) {
			throw new Error('Scenario module must export a default configuration');
		}
		const sampling = scenario.sampling ?? {};
		const frame_budget = scenario.frame_budget ?? {};
		const warmup_ms = ensure_number(sampling.warmup_ms, 'sampling.warmup_ms');
		const duration_ms = ensure_number(sampling.duration_ms, 'sampling.duration_ms');
		const average_budget = ensure_number(frame_budget.average_ms, 'frame_budget.average_ms');
		const percentile_budget = ensure_number(frame_budget.percentile_95_ms, 'frame_budget.percentile_95_ms');
		await bundle_scenario(entry_path, bundle_path, scenario_path);
		const html_path = path.join(temp_dir, 'index.html');
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>Perf profiler</title>
	<style>body,html{margin:0;padding:0;background:#0f172a;color:#0f172a;font-family:system-ui,sans-serif;}*{box-sizing:border-box;}</style>
</head>
<body>
	<div id="root"></div>
	<script src="./bundle.js"></script>
</body>
</html>`;
		await fs.writeFile(html_path, html, 'utf8');
		const browser = await chromium.launch({ headless: args.headless });
		let status = 'pass';
		try {
			const context = await browser.newContext({ viewport: scenario.viewport ?? { width: 1600, height: 900 } });
			const page = await context.newPage();
			await page.goto(`file://${html_path}`);
			await page.waitForFunction(() => window.__PERF_READY__ === true, undefined, { timeout: 20000 });
			const frames = await sample_frame_times(page, warmup_ms, duration_ms);
			const average = frames.reduce((sum, value) => sum + value, 0) / (frames.length || 1);
			const percentile95 = percentile(frames, 95);
			const worst = frames.length ? Math.max(...frames) : Number.NaN;
			const best = frames.length ? Math.min(...frames) : Number.NaN;
			const metadata = await page.evaluate(() => window.__PERF_METADATA__ ?? null);
			const timestamp = create_timestamp();
			const artifact_root = args.artifact_root ?? path.resolve('agents/artifacts/perf', timestamp);
			await ensure_directory(artifact_root);
			const result = {
				agent_id: 'perf-profiler',
				scenario: metadata ?? scenario,
				frames_captured: frames.length,
				samplings: { warmup_ms, duration_ms },
				metrics: {
					average_ms: average,
					percentile_95_ms: percentile95,
					best_frame_ms: best,
					worst_frame_ms: worst,
				},
				thresholds: {
					average_ms: average_budget,
					percentile_95_ms: percentile_budget,
				},
				frames,
			};
			const average_ok = average <= average_budget;
			const percentile_ok = percentile95 <= percentile_budget;
			if (!average_ok || !percentile_ok) {
				status = 'fail';
				result.status = 'fail';
			} else {
				result.status = 'pass';
			}
			await fs.writeFile(path.join(artifact_root, 'metrics.json'), JSON.stringify(result, null, 2), 'utf8');
			const summary_lines = [
				`# Perf snapshot — ${metadata?.label ?? scenario.label}`,
				'',
				metadata?.description ?? scenario.description ?? '',
				'',
				'| Metric | Value (ms) | Budget (ms) | Status |',
				'| --- | ---: | ---: | :---: |',
				format_metric_row('Average frame', average, average_budget, average_ok),
				format_metric_row('95th percentile', percentile95, percentile_budget, percentile_ok),
				'',
				`* Frames captured: ${frames.length}`,
				`* Warmup: ${warmup_ms}ms, sample window: ${duration_ms}ms`,
				`* Best frame: ${best.toFixed(2)}ms, worst frame: ${worst.toFixed(2)}ms`,
			];
			await fs.writeFile(path.join(artifact_root, 'summary.md'), summary_lines.filter(Boolean).join('\n'), 'utf8');
			console.log(`[perf-profiler] ${status.toUpperCase()} average=${average.toFixed(2)}ms p95=${percentile95.toFixed(2)}ms frames=${frames.length}`);
			if (status === 'fail') {
				process.exitCode = 1;
			}
		} finally {
			await browser.close();
		}
		return status;
	} finally {
		await fs.rm(temp_dir, { recursive: true, force: true });
	}
}
main().catch((error) => {
	console.error('[perf-profiler] fatal error');
	console.error(error);
	process.exitCode = 1;
});
