// One opaque folder per post with neutral filenames (needs fs — start n8n with pnpm dev:up).
// This node runs once for each story, so each story gets its own folder.
const fs = require('fs');

const post = $json;
const settings = $('Settings').first().json;
let folder = String(settings.downloadsFolder || '').trim();
if (!folder) folder = '/Users/figueroaf/.n8n-files';
if (folder.startsWith('~/')) {
	throw new Error(
		'Set a full path in Settings → downloadsFolder (example: /Users/you/Downloads). Tilde (~) is not supported.',
	);
}
folder = folder.replace(/\/$/, '');

const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
const postDir = `${folder}/${id}`;
fs.mkdirSync(postDir, { recursive: true });

return {
	json: {
		...post,
		downloadsFolder: folder,
		exportDir: postDir,
		exportId: id,
		fileBase: postDir,
		imagePath: `${postDir}/cover.jpg`,
		captionPath: `${postDir}/note.txt`,
		metaPath: `${postDir}/data.json`,
	},
};
