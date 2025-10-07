import assert from 'node:assert/strict';
import {execSync} from 'node:child_process';
import crypto from 'node:crypto';
import process from 'node:process';

const [agent_id, commit_message] = process.argv.slice(2);
assert(agent_id, 'agent_id argument is required');
assert(commit_message, 'commit message argument is required');

const run = (command, options = {}) => {
	const result = execSync(command, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], ...options});
	return typeof result === 'string' ? result.trim() : '';
};

const status = run('git status --porcelain');
if (!status) {
	console.log(`[${agent_id}] no changes detected; nothing to commit`);
	process.exit(0);
}

const tracked_files = status
	.split('\n')
	.filter(Boolean)
	.map(line => line.slice(3).trim())
	.filter(name => name && name !== '');

const disallowed = tracked_files.filter(file_path => {
	if (file_path.startsWith('docs/')) {
		return false;
	}
	if (file_path.endsWith('.md')) {
		return false;
	}
	return true;
});

assert.strictEqual(disallowed.length, 0, `docs-bot may not modify: ${disallowed.join(', ')}`);

const branch_suffix = crypto.randomBytes(4).toString('hex');
const branch_name = `agents/${agent_id}/${branch_suffix}`;
const base_ref = process.env.GITHUB_BASE_REF || 'main';

run(`git checkout -B ${branch_name}`);
run('git config user.name "docs-bot"');
run('git config user.email "docs-bot@users.noreply.github.com"');
run('git add -A');
run(`git commit -m "${commit_message}"`);

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.DOCS_BOT_TOKEN || process.env.GITHUB_TOKEN;

if (repository && token) {
	const remote_url = `https://${token}@github.com/${repository}.git`;
	run(`git push ${remote_url} ${branch_name}:${branch_name}`);
	console.log(`[${agent_id}] pushed branch ${branch_name}`);
} else {
	console.warn(`[${agent_id}] missing repository or token; skipping push`);
}

if (repository && token) {
	const pr_title = `[agent:${agent_id}] ${commit_message}`;
	const pr_body = [
		'## Automated documentation update',
		'- Source: docs-bot automation',
		'- Reviewers: @docs-owners',
		'',
		'Please review the generated documentation updates before merging.'
	].join('\n');

	const response = await fetch(`https://api.github.com/repos/${repository}/pulls`, {
		method: 'POST',
		headers: {
			'Authorization': `token ${token}`,
			'Accept': 'application/vnd.github+json'
		},
		body: JSON.stringify({
			title: pr_title,
			head: branch_name,
			base: base_ref,
			body: pr_body,
			draft: true
		})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`failed to create pull request: ${response.status} ${text}`);
	}

	const pr = await response.json();
	console.log(`[${agent_id}] opened PR #${pr.number}: ${pr.html_url}`);
} else {
	console.warn(`[${agent_id}] repository or token missing; PR not created`);
}
