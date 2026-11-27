import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
	belongsToCheckout,
	checkoutRootPid,
	isAlive,
	isDevProcess,
	readPid,
	stopPid,
} from './dev-local.mjs';

test('readPid accepts a positive integer and rejects other text', () => {
	assert.equal(readPid('4242\n'), 4242);
	assert.equal(readPid(''), 0);
	assert.equal(readPid('nope'), 0);
	assert.equal(readPid('-5'), 0);
});

test('belongsToCheckout matches this checkout only', () => {
	const root = '/work/n8n';
	assert.equal(belongsToCheckout('/work/n8n', '', root), true);
	assert.equal(belongsToCheckout('/work/n8n/packages/cli', 'node', root), true);
	assert.equal(belongsToCheckout('/work/other', 'node /work/n8n/packages/cli/bin/n8n', root), true);
	assert.equal(belongsToCheckout('/work/n8n-other', 'node', root), false);
	assert.equal(belongsToCheckout('/tmp', 'com.docker.backend', root), false);
});

test('isDevProcess matches the local dev stack and skips the shell', () => {
	assert.equal(isDevProcess('pnpm dev:be'), true);
	assert.equal(isDevProcess('/usr/bin/node packages/cli/node_modules/nodemon/bin/nodemon.js'), true);
	assert.equal(isDevProcess('zsh'), false);
});

test('checkoutRootPid stops at the shell that launched the dev process', () => {
	const root = '/work/n8n';
	const processes = {
		10: { ppid: 9, cwd: root, command: 'node nodemon' },
		9: { ppid: 8, cwd: root, command: 'pnpm dev:be' },
		8: { ppid: 1, cwd: root, command: 'zsh' },
	};
	const inspect = {
		parentPid: (pid) => processes[pid]?.ppid ?? 0,
		process: (pid) => processes[pid],
	};
	assert.equal(checkoutRootPid(10, root, inspect), 9);
});

test('stopPid ends a detached process group', async () => {
	const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
	child.unref();
	assert.equal(isAlive(child.pid), true);
	assert.equal(await stopPid(child.pid), true);
	assert.equal(isAlive(child.pid), false);
});

test('stopLocalBackend removes a stale pid file', async () => {
	const { stopLocalBackend } = await import('./dev-local.mjs');
	const dir = mkdtempSync(join(tmpdir(), 'n8n-dev-down-'));
	const pidFile = join(dir, 'dev.pid');
	writeFileSync(pidFile, '999999\n');
	const result = await stopLocalBackend({
		repoRoot: dir,
		port: 1,
		pidFile,
	});
	assert.equal(result.stopped, false);
	assert.equal(result.stillRunning, false);
	assert.equal(existsSync(pidFile), false);
});
