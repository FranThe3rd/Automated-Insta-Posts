// Shared start and stop state for the local backend.
// `pnpm dev:up` records the process group. `pnpm dev:down` stops that group.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const DEV_PID_FILE = '/tmp/n8n-dev-be.pid';
export const DEV_LOG = '/tmp/n8n-dev-be.log';

/** Env for UFC workflow file writes when using `pnpm dev:up` (no `.env.local` required). */
export function localWorkflowDevEnv(repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
	const home = homedir();
	const assets = join(repoRoot, 'workflows/assets');
	return {
		N8N_RESTRICT_FILE_ACCESS_TO: `${home}/.n8n-files;${home}/Downloads;${assets}`,
	};
}

export const WORKFLOW_LOGO_FILE = 'fw-logo-black-bg.png';

export function workflowLogoPath() {
	return join(homedir(), '.n8n-files', WORKFLOW_LOGO_FILE);
}

/** Read/Write File nodes do not create the export parent dir; create it before the first run. */
export function ensureWorkflowExportDirs(repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
	const home = homedir();
	for (const dir of [`${home}/.n8n-files`, `${home}/Downloads`]) {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}
	const source = join(repoRoot, 'workflows/assets', WORKFLOW_LOGO_FILE);
	const target = workflowLogoPath();
	if (existsSync(source)) {
		copyFileSync(source, target);
	}
}

const DEV_COMMAND = /\b(pnpm|turbo|nodemon|concurrently|tsc|node)\b/;

export const repoRootFrom = (importMetaUrl) =>
	resolve(dirname(fileURLToPath(importMetaUrl)), '..');

export function readPid(text) {
	const pid = Number(String(text).trim());
	if (!Number.isInteger(pid) || pid <= 0) return 0;
	return pid;
}

export function belongsToCheckout(cwd, command, repoRoot) {
	const root = resolve(repoRoot);
	if (cwd) {
		const dir = resolve(cwd);
		if (dir === root || dir.startsWith(`${root}${sep}`)) return true;
	}
	return Boolean(command && command.includes(root));
}

export const isDevProcess = (command) => DEV_COMMAND.test(command ?? '');

export function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error?.code === 'EPERM';
	}
}

function signalGroup(pid, signal) {
	try {
		process.kill(-pid, signal);
		return;
	} catch {
		// The pid is not a process-group leader. Signal the process itself.
	}
	try {
		process.kill(pid, signal);
	} catch {
		// The process has already exited.
	}
}

export async function stopPid(pid, timeoutMs = 5000) {
	if (!pid || !isAlive(pid)) return false;
	signalGroup(pid, 'SIGTERM');
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!isAlive(pid)) return true;
		await sleep(100);
	}
	signalGroup(pid, 'SIGKILL');
	await sleep(100);
	return !isAlive(pid);
}

function commandOf(pid) {
	const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
	return result.stdout?.trim() ?? '';
}

function cwdOf(pid) {
	const result = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
		encoding: 'utf8',
	});
	const line = result.stdout?.split('\n').find((entry) => entry.startsWith('n'));
	return line?.slice(1) ?? '';
}

function parentPid(pid) {
	const result = spawnSync('ps', ['-p', String(pid), '-o', 'ppid='], { encoding: 'utf8' });
	const parent = Number(result.stdout?.trim());
	return Number.isInteger(parent) ? parent : 0;
}

export function pidsListening(port) {
	const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
		encoding: 'utf8',
	});
	if (!result.stdout) return [];
	return [
		...new Set(
			result.stdout
				.trim()
				.split('\n')
				.map((line) => Number(line))
				.filter((pid) => pid > 0),
		),
	];
}

export function checkoutRootPid(pid, repoRoot, inspect = defaultInspect) {
	let current = pid;
	let top = pid;
	for (let depth = 0; depth < 15; depth++) {
		const parent = inspect.parentPid(current);
		if (parent <= 1) break;
		const info = inspect.process(parent);
		if (!isDevProcess(info.command)) break;
		if (!belongsToCheckout(info.cwd, info.command, repoRoot)) break;
		top = parent;
		current = parent;
	}
	return top;
}

const defaultInspect = {
	parentPid,
	process: (pid) => ({ cwd: cwdOf(pid), command: commandOf(pid) }),
};

function ourListeners(port, repoRoot) {
	return pidsListening(port).filter((pid) => {
		const command = commandOf(pid);
		return isDevProcess(command) && belongsToCheckout(cwdOf(pid), command, repoRoot);
	});
}

// Stop the recorded process group, then any leftover listener from this checkout.
// Leave a process that only happens to use the same port.
export async function stopLocalBackend({ repoRoot, port, pidFile = DEV_PID_FILE }) {
	const stopped = new Set();
	if (existsSync(pidFile)) {
		const pid = readPid(readFileSync(pidFile, 'utf8'));
		if (await stopPid(pid)) stopped.add(pid);
		rmSync(pidFile, { force: true });
	}
	for (const listener of ourListeners(port, repoRoot)) {
		const root = checkoutRootPid(listener, repoRoot);
		await stopPid(root);
		if (root !== listener) await stopPid(listener);
		stopped.add(listener);
	}
	return {
		stopped: stopped.size > 0,
		stillRunning: ourListeners(port, repoRoot).length > 0,
		portBusy: pidsListening(port).length > 0,
	};
}
