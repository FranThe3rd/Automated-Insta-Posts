#!/usr/bin/env node
// Stop the local backend that `pnpm dev:up` started.
//
//   pnpm dev:down
import { servePort } from './codespace-preview/serve-ready.mjs';
import { repoRootFrom, stopLocalBackend } from './dev-local.mjs';

const port = servePort();
const repoRoot = repoRootFrom(import.meta.url);
const { stopped, stillRunning, portBusy } = await stopLocalBackend({ repoRoot, port });

if (stillRunning) {
	console.error(`A process from this checkout is still listening on port ${port}.`);
	process.exit(1);
}

if (!stopped && portBusy) {
	console.log(`This checkout is not running. Port ${port} is in use by another process.`);
} else if (!stopped) {
	console.log('Local n8n is already stopped.');
} else if (portBusy) {
	console.log(`Stopped local n8n. Port ${port} is still in use by another process.`);
} else {
	console.log('Stopped local n8n.');
}
