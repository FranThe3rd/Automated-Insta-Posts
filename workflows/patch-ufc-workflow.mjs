import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('./ufc-news-to-instagram.json', import.meta.url);
const workflow = JSON.parse(readFileSync(path, 'utf8'));

const buildCode = readFileSync(new URL('./lib/build-instagram-posts.js', import.meta.url), 'utf8');

const setupNote = `## UFC news → Instagram

Posts the newest UFC story to Instagram at the times you choose. A story is never posted twice.

### Setup
1. **Instagram account**: Business or Creator, linked to a Facebook Page.
2. **Credential**: Facebook Graph API token with \`instagram_basic\`, \`instagram_content_publish\`, \`pages_show_list\`.
3. **Account ID**: \`me/accounts?fields=instagram_business_account\` → put id in **Settings**.
4. **Local AI (Ollama)**: install [Ollama](https://ollama.com), run \`ollama pull llama3.2\`, and keep Ollama on \`http://127.0.0.1:11434\`. Set model in **Settings** if you use another tag.
5. **Logo watermark**: upload \`workflows/assets/fw-logo-black-bg.png\` somewhere public (GitHub raw, Imgur, CDN) and paste the URL in **Settings → logoPublicUrl**. Instagram and the image proxy must reach it over HTTPS.
6. **Post time**: edit **Schedule Trigger** (timezone in workflow Settings).
7. **Publish** the workflow.

Manual test runs can post to Instagram but do not save the posted-story list unless the run was scheduled.`;

const sourcesNote = `### News, AI captions, and branding
- Edit sources in **News sources** (UFC.com, ESPN MMA, MMA Fighting, Sherdog, MMA News, BJPenn, LowKick MMA, Cageside Press).
- **Ollama** writes each caption from the headline and article summary. If Ollama is down, the workflow falls back to the RSS summary.
- **logoPublicUrl** must be a public HTTPS link to your black-background logo PNG (file in \`workflows/assets/\`).
- Images are converted to 1080×1080 JPEG and get the logo in the bottom-right via images.weserv.nl.`;

const settingsNode = workflow.nodes.find((n) => n.name === 'Settings');
settingsNode.parameters.assignments.assignments.push(
	{
		id: 'ollama-base-url',
		name: 'ollamaBaseUrl',
		value: 'http://127.0.0.1:11434',
		type: 'string',
	},
	{
		id: 'ollama-model',
		name: 'ollamaModel',
		value: 'llama3.2',
		type: 'string',
	},
	{
		id: 'logo-public-url',
		name: 'logoPublicUrl',
		value: 'PASTE_PUBLIC_HTTPS_URL_TO_workflows_assets_fw-logo-black-bg.png',
		type: 'string',
	},
	{ id: 'logo-mark-scale', name: 'logoMarkScale', value: 14, type: 'number' },
	{ id: 'logo-mark-pad', name: 'logoMarkPad', value: 22, type: 'number' },
);

const newsSourcesCode = readFileSync(new URL('./lib/news-sources.js', import.meta.url), 'utf8');
const pickStoriesCode = readFileSync(new URL('./lib/pick-new-ufc-stories.js', import.meta.url), 'utf8');

for (const node of workflow.nodes) {
	if (node.name === 'Setup notes') node.parameters.content = setupNote;
	if (node.name === 'Sources notes') node.parameters.content = sourcesNote;
	if (node.name === 'News sources') node.parameters.jsCode = newsSourcesCode;
	if (node.name === 'Pick new UFC stories') node.parameters.jsCode = pickStoriesCode;
	if (node.name === 'Build Instagram posts') node.parameters.jsCode = buildCode;
}

writeFileSync(path, `${JSON.stringify(workflow, null, '\t')}\n`);
console.log('patched', path.pathname);