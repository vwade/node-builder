import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve('agents/contracts');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(file_name => file_name.endsWith('.yaml')) : [];

assert(files.length > 0, 'no contract files found');

for (const file_name of files) {
	const raw = fs.readFileSync(path.join(dir, file_name), 'utf8');
	assert(raw.includes('agent_id:'), `missing agent_id in ${file_name}`);
	assert(raw.includes('triggers:'), `missing triggers in ${file_name}`);
	assert(raw.includes('writes_allowed:'), `missing writes_allowed in ${file_name}`);
	console.log('ok', file_name);
}
