#!/usr/bin/env node
// Bring the app up with one command. This script installs missing dependencies,
// builds if you ask, starts the backend, waits for health, and prints the URL.
//
//   pnpm dev:up            install if needed, start dev:be, print the URL
//   pnpm dev:up --build    stop the running backend, then build, then start
//   pnpm dev:down          stop the backend this command started
//
// dev:be serves the editor from the `dist` build. A frontend change appears only
// after `--build` and this restart. For live frontend hot reload, use
// `pnpm dev:fe:editor` on 8080. That path needs `pnpm session tunnel 5678 8080`.
//
// For a PR preview instead of your own session, use `pnpm preview up <pr>`.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	reportUp,
	serveHealthPath,
	servePort,
	shareWithOrg,
	waitForHealth,
} from './codespace-preview/serve-ready.mjs';
import {
	DEV_LOG,
	DEV_PID_FILE,
	ensureWorkflowExportDirs,
	localWorkflowDevEnv,
	repoRootFrom,
	stopLocalBackend,
} from './dev-local.mjs';

const build = process.argv.includes('--build');
const port = servePort();
const healthPath = serveHealthPath();
const BUILD_LOG = '/tmp/dev-up-build.log';
const repoRoot = repoRootFrom(import.meta.url);

process.chdir(repoRoot);

async function isHealthy() {
	try {
		const res = await fetch(`http://127.0.0.1:${port}${healthPath}`, {
			signal: AbortSignal.timeout(2000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

if (build) {
	await stopLocalBackend({ repoRoot, port });
} else if (await isHealthy()) {
	console.log('Local n8n is already up.');
	reportUp(port, shareWithOrg(port));
	console.log('Stop it with pnpm dev:down.');
	process.exit(0);
}

const depsReady =
	existsSync(join(repoRoot, 'node_modules')) &&
	existsSync(join(repoRoot, 'packages/cli/node_modules'));
if (!depsReady) {
	console.log('Installing dependencies…');
	execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });
}

if (build) {
	console.log(`Building (turbo cache — fast when warm; log: ${BUILD_LOG})…`);
	const fd = openSync(BUILD_LOG, 'w');
	try {
		execFileSync('pnpm', ['build'], { cwd: repoRoot, stdio: ['ignore', fd, fd] });
	} catch {
		console.error(`Build failed — see ${BUILD_LOG}:`);
		execFileSync('tail', ['-n', '30', BUILD_LOG], { stdio: 'inherit' });
		process.exit(1);
	}
}

ensureWorkflowExportDirs(repoRoot);

console.log(`Starting backend (pnpm dev:be:local; log: ${DEV_LOG})…`);
const fd = openSync(DEV_LOG, 'a');
const child = spawn('pnpm', ['dev:be:local'], {
	cwd: repoRoot,
	detached: true,
	stdio: ['ignore', fd, fd],
	env: {
		...process.env,
		...localWorkflowDevEnv(repoRoot),
	},
});
if (!child.pid) {
	console.error('Failed to start pnpm dev:be.');
	process.exit(1);
}
child.unref();
writeFileSync(DEV_PID_FILE, `${child.pid}\n`);

if (!(await waitForHealth(port, healthPath))) {
	console.error(`\nBackend did not answer ${healthPath} within 2 min — check ${DEV_LOG}`);
	process.exit(1);
}

reportUp(port, shareWithOrg(port));
console.log('Stop it with pnpm dev:down.');
