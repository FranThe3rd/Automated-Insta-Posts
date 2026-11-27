import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const defaultLogoPath = join(homedir(), '.n8n-files/fw-logo-black-bg.png');

const readCode = (name) => readFileSync(new URL(`./lib/${name}`, import.meta.url), 'utf8');
const ig = JSON.parse(readFileSync(new URL('./ufc-news-to-instagram.json', import.meta.url), 'utf8'));

const sharedNames = new Set([
	'News sources',
	'Read news feeds',
	'Pick new UFC stories',
	'Fetch article pages',
	'Build Instagram posts',
	'Check images',
]);
const shared = ig.nodes.filter((n) => sharedNames.has(n.name));

const node = (name, type, typeVersion, position, parameters, extra = {}) => ({
	parameters,
	id: randomUUID(),
	name,
	type,
	typeVersion,
	position,
	...extra,
});

const BROWSER_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const setupNote = `## UFC news → Downloads (preview)

Builds the same UFC post as the Instagram workflow (Ollama caption + logo on the image) and saves files to your Mac. Nothing is posted to Instagram.

### Output (per run)
Files save under **Settings → downloadsFolder** (default \`~/.n8n-files\`, allowed by n8n):
- \`YYYY-MM-DDTHH-MM-SS-story.jpg\` — square post image
- \`...-caption.txt\` — caption text
- \`...-meta.json\` — title, link, paths

### Setup
1. Install Ollama and pull your model (\`ollama pull llama3.2\`) — captions use **Settings → ollamaModel**.
2. Logo watermark: \`pnpm dev:up\` copies \`workflows/assets/fw-logo-black-bg.png\` to **~/.n8n-files/** (black background). **logoFilePath** points there.
3. Captions end with lowercase UFC hashtags from **Settings → hashtags**.
4. Click **Test workflow** or use the schedule.
5. To save in **Downloads**: set **downloadsFolder** to \`/Users/you/Downloads\`, then start n8n with \`pnpm dev:up\`.
6. Works on local n8n only (not n8n Cloud).`;

const nodes = [
	node('Setup notes', 'n8n-nodes-base.stickyNote', 1, [-520, -120], {
		content: setupNote,
		height: 520,
		width: 420,
	}),
	node('Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, [-200, 160], {}),
	node(
		'Schedule Trigger',
		'n8n-nodes-base.scheduleTrigger',
		1.2,
		[-200, -40],
		{
			rule: {
				interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 9, triggerAtMinute: 0 }],
			},
		},
	),
	node('Settings', 'n8n-nodes-base.set', 3.4, [20, 60], {
		assignments: {
			assignments: [
				{
					id: randomUUID(),
					name: 'downloadsFolder',
					value: '/Users/figueroaf/.n8n-files',
					type: 'string',
				},
				{
					id: randomUUID(),
					name: 'hashtags',
					value: '#ufc #mma #ufcnews #mixedmartialarts #fightnews',
					type: 'string',
				},
				{ id: randomUUID(), name: 'maxStoryAgeHours', value: 48, type: 'number' },
				{
					id: randomUUID(),
					name: 'ollamaBaseUrl',
					value: 'http://127.0.0.1:11434',
					type: 'string',
				},
				{ id: randomUUID(), name: 'ollamaModel', value: 'llama3.2', type: 'string' },
				{
					id: randomUUID(),
					name: 'logoFilePath',
					value: defaultLogoPath,
					type: 'string',
				},
				{ id: randomUUID(), name: 'logoMarkScale', value: 14, type: 'number' },
				{ id: randomUUID(), name: 'logoMarkPad', value: 22, type: 'number' },
			],
		},
		options: {},
	}),
	...shared.map((n) => ({ ...n, id: randomUUID() })),
	node('Choose story to export', 'n8n-nodes-base.code', 2, [1760, 60], {
		jsCode: readCode('choose-story-to-export.js'),
	}),
	node('Prepare export paths', 'n8n-nodes-base.code', 2, [1980, 60], {
		jsCode: readCode('prepare-export-paths.js'),
	}),
	node(
		'Download post image',
		'n8n-nodes-base.httpRequest',
		4.2,
		[2200, 60],
		{
			url: '={{ $json.imageUrl }}',
			options: {
				response: {
					response: {
						responseFormat: 'file',
						outputPropertyName: 'data',
					},
				},
				timeout: 60000,
			},
		},
	),
	node('Ensure image downloaded', 'n8n-nodes-base.code', 2, [2310, 60], {
		jsCode: readCode('ensure-image-downloaded.js'),
	}),
	node('Read logo asset', 'n8n-nodes-base.readWriteFile', 1.1, [2420, -60], {
		operation: 'read',
		fileSelector: "={{ $('Settings').first().json.logoFilePath }}",
		options: { dataPropertyName: 'logo' },
	}),
	node('Attach logo binary', 'n8n-nodes-base.code', 2, [2530, 60], {
		jsCode: readCode('attach-logo-binary.js'),
	}),
	node('Resize logo', 'n8n-nodes-base.editImage', 2, [2750, 60], {
		operation: 'resize',
		dataPropertyName: 'logo',
		width: "={{ Math.round(1080 * $('Settings').first().json.logoMarkScale / 100) }}",
		height: "={{ Math.round(1080 * $('Settings').first().json.logoMarkScale / 100) }}",
		resizeOption: 'ignoreAspectRatio',
		options: { destinationKey: 'logo' },
	}),
	node('Apply logo watermark', 'n8n-nodes-base.editImage', 2, [2970, 60], {
		operation: 'composite',
		dataPropertyName: 'data',
		dataPropertyNameComposite: 'logo',
		operator: 'Over',
		positionX:
			'={{ Math.round(1080 - 1080 * $("Settings").first().json.logoMarkScale / 100 - $("Settings").first().json.logoMarkPad) }}',
		positionY:
			'={{ Math.round(1080 - 1080 * $("Settings").first().json.logoMarkScale / 100 - $("Settings").first().json.logoMarkPad) }}',
		options: {},
	}),
	node('Write post image', 'n8n-nodes-base.readWriteFile', 1.1, [3190, 60], {
		operation: 'write',
		fileName: '={{ $json.imagePath }}',
		dataPropertyName: 'data',
		options: {},
	}),
	node('Finalize export', 'n8n-nodes-base.code', 2, [3410, 60], {
		jsCode: readCode('finalize-export.js'),
	}),
	node('Write caption file', 'n8n-nodes-base.readWriteFile', 1.1, [3630, 60], {
		operation: 'write',
		fileName: '={{ $json.captionPath }}',
		dataPropertyName: 'captionFile',
		options: {},
	}),
	node('Write meta file', 'n8n-nodes-base.readWriteFile', 1.1, [3850, 60], {
		operation: 'write',
		fileName: '={{ $json.metaPath }}',
		dataPropertyName: 'metaFile',
		options: {},
	}),
	node('Remember exported story', 'n8n-nodes-base.code', 2, [4070, 60], {
		jsCode: readCode('remember-exported-story.js'),
	}),
];

const main = (...targets) => ({
	main: targets.map((list) => list.map((name) => ({ node: name, type: 'main', index: 0 }))),
});

const connections = {
	'Manual Trigger': main(['Settings']),
	'Schedule Trigger': main(['Settings']),
	Settings: main(['News sources']),
	'News sources': main(['Read news feeds']),
	'Read news feeds': main(['Pick new UFC stories']),
	'Pick new UFC stories': main(['Fetch article pages']),
	'Fetch article pages': main(['Build Instagram posts']),
	'Build Instagram posts': main(['Check images']),
	'Check images': main(['Choose story to export']),
	'Choose story to export': main(['Prepare export paths']),
	'Prepare export paths': main(['Download post image']),
	'Download post image': main(['Ensure image downloaded']),
	'Ensure image downloaded': main(['Read logo asset']),
	'Read logo asset': main(['Attach logo binary']),
	'Attach logo binary': main(['Resize logo']),
	'Resize logo': main(['Apply logo watermark']),
	'Apply logo watermark': main(['Write post image']),
	'Write post image': main(['Finalize export']),
	'Finalize export': main(['Write caption file']),
	'Write caption file': main(['Write meta file']),
	'Write meta file': main(['Remember exported story']),
};

nodes[ nodes.findIndex((n) => n.name === 'Build Instagram posts')].parameters.jsCode = readCode(
	'build-instagram-posts.js',
);

const workflow = {
	name: 'UFC news to Downloads',
	nodes,
	connections,
	active: false,
	settings: { executionOrder: 'v1', timezone: 'America/New_York' },
	pinData: {},
	meta: { templateCredsSetupCompleted: true },
};

writeFileSync(
	new URL('./ufc-news-to-downloads.json', import.meta.url),
	`${JSON.stringify(workflow, null, '\t')}\n`,
);

for (const n of nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
	for (const ref of n.parameters.jsCode.matchAll(/\$\('([^']+)'\)/g)) {
		if (!nodes.some((x) => x.name === ref[1])) throw new Error(`${n.name} missing ${ref[1]}`);
	}
	new Function('$', '$input', '$json', '$getWorkflowStaticData', 'fetch', 'AbortSignal', n.parameters.jsCode);
}

console.log('wrote ufc-news-to-downloads.json', nodes.length, 'nodes');