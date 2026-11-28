import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureWorkflowExportDirs } from '../scripts/dev-local.mjs';

const workflowsDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(dirname(workflowsDir));
const defaultLogoPath = join(workflowsDir, 'assets/fw-logo-black-bg.png');
const defaultLogoHome = join(homedir(), '.n8n-files/fw-logo-black-bg.png');

const readCode = (name) => readFileSync(new URL(`./lib/${name}`, import.meta.url), 'utf8');
const downloadsTemplate = JSON.parse(
	readFileSync(new URL('./ufc-news-to-downloads.json', import.meta.url), 'utf8'),
);

const sharedNames = new Set([
	'News sources',
	'Read news feeds',
	'Pick new UFC stories',
	'Fetch article pages',
	'Build Instagram posts',
	'Check images',
]);
const shared = downloadsTemplate.nodes.filter((n) => sharedNames.has(n.name));

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

Builds up to **exportsPerRun** UFC posts per run (default **5**) and saves them to your Mac. Nothing is posted to Instagram.

### Output (per run)
Each story gets its own folder under **Settings → downloadsFolder** (default \`~/.n8n-files\`):
- \`<random-id>/cover.jpg\` — 1080×1920 story image (9:16)
- \`<random-id>/note.txt\` — caption
- \`<random-id>/data.json\` — title, link, paths, and \`captionSource\`

### Image
Blurred backdrop, the full photo, the headline, your logo, and the outlet name. Important parts stay clear of the top and bottom of the screen.
- Size: **imageWidth** × **imageHeight** (use 1080 × 1350 for a 4:5 feed post).
- Look: **postLabel**, **accentColor**, **headlineFont**, **detailFont**, **logoMarkScale**. The fonts are macOS font files.

### Caption
Ollama writes a hook, 2 to 3 sentences, and a question for each story. Captions use at most **5 hashtags** (from **hashtags**, then event or fighter tags if there is room).
- \`captionSource\` in data.json is \`ollama\` or \`backup\`. \`backup\` means Ollama did not answer; \`captionError\` says why.
- Set **includeLinkInCaption** to true to add the article link.

### Setup
1. Start Ollama (\`ollama serve\`) and pull the model in **ollamaModel** (\`ollama pull llama3.2\`).
2. Logo: \`workflows/assets/fw-logo-black-bg.png\`. Backup copy in **~/.n8n-files/** after \`pnpm dev:up\`.
3. Click **Test workflow** or use the schedule.
4. To save in **Downloads**: set **downloadsFolder** to \`/Users/you/Downloads\`, then start n8n with \`pnpm dev:up\`.
5. Works on local n8n only (not n8n Cloud).`;

const HEADLINE_FONT = '/System/Library/Fonts/Supplemental/Impact.ttf';
const DETAIL_FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';

const setting = (name) => `$('Settings').first().json.${name}`;
const expr = (code) => `={{ ${code} }}`;
// A value that "Plan story layout" calculated.
const layout = (path) => expr(`$json.layout.${path}`);
const accent = expr(setting('accentColor'));

// Edit Image "Multi Step" operations. Each one lists every field, because n8n does not fill
// defaults for nested operations when a workflow is imported from a file.
const drawBox = (color, x1, y1, x2, y2, cornerRadius = 0) => ({
	operation: 'draw',
	primitive: 'rectangle',
	color,
	startPositionX: x1,
	startPositionY: y1,
	endPositionX: x2,
	endPositionY: y2,
	cornerRadius,
});

const drawText = (text, { font, fontSize, color, x, y, align = 'west' }) => ({
	operation: 'text',
	text,
	font,
	fontSize,
	fontColor: color,
	positionX: x,
	positionY: y,
	horizontalAlignment: align,
	verticalAlignment: 'north',
	// The layout node wraps the text, so this limit must not wrap it again.
	lineLength: 500,
});

const placeImage = (property, x, y) => ({
	operation: 'composite',
	dataPropertyNameComposite: property,
	operator: 'Over',
	positionX: x,
	positionY: y,
});

const HEADLINE_LINES = 5;

const nodes = [
	node('Setup notes', 'n8n-nodes-base.stickyNote', 1, [-560, -240], {
		content: setupNote,
		height: 760,
		width: 460,
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
				{ id: randomUUID(), name: 'includeLinkInCaption', value: false, type: 'boolean' },
				{ id: randomUUID(), name: 'imageWidth', value: 1080, type: 'number' },
				{ id: randomUUID(), name: 'imageHeight', value: 1920, type: 'number' },
				{ id: randomUUID(), name: 'postLabel', value: 'UFC NEWS', type: 'string' },
				{ id: randomUUID(), name: 'accentColor', value: '#D20A0A', type: 'string' },
				{ id: randomUUID(), name: 'headlineFont', value: HEADLINE_FONT, type: 'string' },
				{ id: randomUUID(), name: 'detailFont', value: DETAIL_FONT, type: 'string' },
				{
					id: randomUUID(),
					name: 'logoFilePath',
					value: defaultLogoPath,
					type: 'string',
				},
				{ id: randomUUID(), name: 'logoMarkScale', value: 12, type: 'number' },
				{ id: randomUUID(), name: 'exportsPerRun', value: 5, type: 'number' },
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
	node('Build caption prompt', 'n8n-nodes-base.code', 2, [2200, 60], {
		jsCode: readCode('build-caption-prompt.js'),
	}),
	node(
		'Ask Ollama for caption',
		'n8n-nodes-base.httpRequest',
		4.2,
		[2420, 60],
		{
			method: 'POST',
			url: `${expr(`${setting('ollamaBaseUrl')}.replace(/\\/+$/, '')`)}/api/chat`,
			sendBody: true,
			specifyBody: 'json',
			jsonBody: expr('JSON.stringify($json.ollamaRequest)'),
			options: {
				response: { response: { neverError: true } },
				timeout: 180000,
			},
		},
		// "Finish caption" uses the backup caption when Ollama is not running.
		{ onError: 'continueRegularOutput' },
	),
	node('Finish caption', 'n8n-nodes-base.code', 2, [2640, 60], {
		jsCode: readCode('finish-caption.js'),
	}),
	node('Download backdrop', 'n8n-nodes-base.httpRequest', 4.2, [2860, 60], {
		url: expr('$json.backdropUrl'),
		options: {
			response: { response: { responseFormat: 'file', outputPropertyName: 'data' } },
			timeout: 60000,
		},
	}),
	node('Download photo', 'n8n-nodes-base.httpRequest', 4.2, [3080, 60], {
		url: expr('$json.photoUrl'),
		options: {
			response: { response: { responseFormat: 'file', outputPropertyName: 'photo' } },
			timeout: 60000,
		},
	}),
	node('Read photo size', 'n8n-nodes-base.editImage', 2, [3300, 60], {
		operation: 'information',
		dataPropertyName: 'photo',
	}),
	node('Plan story layout', 'n8n-nodes-base.code', 2, [3520, 60], {
		jsCode: readCode('plan-story-layout.js'),
	}),
	node('Load logo', 'n8n-nodes-base.code', 2, [3740, 60], {
		mode: 'runOnceForAllItems',
		jsCode: readCode('load-logo-with-fallback.js'),
	}),
	node('Fit photo', 'n8n-nodes-base.editImage', 2, [3960, 60], {
		operation: 'multiStep',
		dataPropertyName: 'photo',
		operations: {
			operations: [
				{
					operation: 'resize',
					width: layout('photo.width'),
					height: layout('photo.fullHeight'),
					resizeOption: 'ignoreAspectRatio',
				},
				{
					operation: 'crop',
					width: layout('photo.width'),
					height: layout('photo.height'),
					positionX: 0,
					positionY: layout('photo.cropY'),
				},
			],
		},
		options: { format: 'png' },
	}),
	node('Resize logo', 'n8n-nodes-base.editImage', 2, [4180, 60], {
		operation: 'resize',
		dataPropertyName: 'logo',
		width: layout('logo.size'),
		height: layout('logo.size'),
		resizeOption: 'ignoreAspectRatio',
		options: { destinationKey: 'logo' },
	}),
	node('Compose story image', 'n8n-nodes-base.editImage', 2, [4400, 60], {
		operation: 'multiStep',
		dataPropertyName: 'data',
		operations: {
			operations: [
				// Darken the backdrop. The last two digits are opacity the old way: 00 is solid, FF is clear.
				drawBox('#0000005C', 0, 0, layout('width'), layout('height')),
				placeImage('photo', 0, layout('photo.y')),
				drawBox(accent, 0, layout('bar.y1'), layout('width'), layout('bar.y2')),
				drawBox(
					accent,
					layout('pill.x1'),
					layout('pill.y1'),
					layout('pill.x2'),
					layout('pill.y2'),
					layout('pill.radius'),
				),
				drawText(layout('pill.text'), {
					font: expr(setting('headlineFont')),
					fontSize: layout('pill.fontSize'),
					color: '#FFFFFF',
					x: layout('pill.textX'),
					y: layout('pill.textY'),
				}),
				placeImage('logo', layout('logo.x'), layout('logo.y')),
				drawText(layout('source.text'), {
					font: expr(setting('detailFont')),
					fontSize: layout('source.fontSize'),
					color: '#D6D6D6',
					x: layout('source.right'),
					y: layout('source.y'),
					align: 'east',
				}),
				...Array.from({ length: HEADLINE_LINES }, (_, line) =>
					drawText(layout(`headline.lines[${line}]`), {
						font: expr(setting('headlineFont')),
						fontSize: layout('headline.fontSize'),
						color: '#FFFFFF',
						x: layout('headline.x'),
						y: layout(`headline.y[${line}]`),
					}),
				),
			],
		},
		options: { format: 'jpeg', quality: 92, fileName: 'cover.jpg' },
	}),
	node('Write post image', 'n8n-nodes-base.readWriteFile', 1.1, [4620, 60], {
		operation: 'write',
		fileName: '={{ $json.imagePath }}',
		dataPropertyName: 'data',
		options: {},
	}),
	node('Finalize export', 'n8n-nodes-base.code', 2, [4840, 60], {
		jsCode: readCode('finalize-export.js'),
	}),
	node('Write caption file', 'n8n-nodes-base.readWriteFile', 1.1, [5060, 60], {
		operation: 'write',
		fileName: '={{ $json.captionPath }}',
		dataPropertyName: 'captionFile',
		options: {},
	}),
	node('Write meta file', 'n8n-nodes-base.readWriteFile', 1.1, [5280, 60], {
		operation: 'write',
		fileName: '={{ $json.metaPath }}',
		dataPropertyName: 'metaFile',
		options: {},
	}),
	node('Remember exported story', 'n8n-nodes-base.code', 2, [5500, 60], {
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
	'Prepare export paths': main(['Build caption prompt']),
	'Build caption prompt': main(['Ask Ollama for caption']),
	'Ask Ollama for caption': main(['Finish caption']),
	'Finish caption': main(['Download backdrop']),
	'Download backdrop': main(['Download photo']),
	'Download photo': main(['Read photo size']),
	'Read photo size': main(['Plan story layout']),
	'Plan story layout': main(['Load logo']),
	'Load logo': main(['Fit photo']),
	'Fit photo': main(['Resize logo']),
	'Resize logo': main(['Compose story image']),
	'Compose story image': main(['Write post image']),
	'Write post image': main(['Finalize export']),
	'Finalize export': main(['Write caption file']),
	'Write caption file': main(['Write meta file']),
	'Write meta file': main(['Remember exported story']),
};

for (const [name, file] of [
	['News sources', 'news-sources.js'],
	['Pick new UFC stories', 'pick-new-ufc-stories.js'],
	['Build Instagram posts', 'build-instagram-posts.js'],
	['Choose story to export', 'choose-story-to-export.js'],
	['Finish caption', 'finish-caption.js'],
	['Plan story layout', 'plan-story-layout.js'],
	['Remember exported story', 'remember-exported-story.js'],
	['Load logo', 'load-logo-with-fallback.js'],
]) {
	const node = nodes.find((n) => n.name === name);
	if (node) node.parameters.jsCode = readCode(file);
}

// These Code nodes handle one story. The default mode runs once for all items and returns only one.
for (const name of [
	'Prepare export paths',
	'Build caption prompt',
	'Finish caption',
	'Plan story layout',
	'Finalize export',
	'Remember exported story',
]) {
	nodes.find((n) => n.name === name).parameters.mode = 'runOnceForEachItem';
}

const workflow = {
	name: 'UFC news to Downloads',
	nodes,
	connections,
	active: false,
	settings: { executionOrder: 'v1', timezone: 'America/New_York' },
	pinData: {},
	meta: { templateCredsSetupCompleted: true },
};

// The Code node sandbox has JavaScript built-ins only. These web and Node.js globals do not exist
// there, and a call to one fails at run time. Use an HTTP Request node or a pattern instead.
const MISSING_IN_SANDBOX =
	/(?<![.\w$'"`])(?:new\s+)?(fetch|URL|URLSearchParams|AbortSignal|AbortController|process|structuredClone)\s*[.(]/;

for (const n of nodes) {
	for (const ref of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g)) {
		if (!nodes.some((x) => x.name === ref[1])) throw new Error(`${n.name} missing ${ref[1]}`);
	}
	if (n.type !== 'n8n-nodes-base.code') continue;
	new Function('$', '$input', '$json', '$getWorkflowStaticData', n.parameters.jsCode);
	const missing = n.parameters.jsCode.match(MISSING_IN_SANDBOX);
	if (missing) throw new Error(`${n.name} uses ${missing[1]}, which the Code node sandbox does not have`);
}

for (const [from, targets] of Object.entries(connections)) {
	for (const name of [from, ...targets.main.flat().map((target) => target.node)]) {
		if (!nodes.some((x) => x.name === name)) throw new Error(`Connection uses missing node ${name}`);
	}
}

ensureWorkflowExportDirs(repoRoot);

writeFileSync(
	new URL('./ufc-news-to-downloads.json', import.meta.url),
	`${JSON.stringify(workflow, null, '\t')}\n`,
);

console.log('wrote ufc-news-to-downloads.json', nodes.length, 'nodes');