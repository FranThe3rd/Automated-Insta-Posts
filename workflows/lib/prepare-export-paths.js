// Build local file paths under the Downloads folder.
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

const slug = String(post.title || 'ufc-story')
	.toLowerCase()
	.normalize('NFKD')
	.replace(/[\u0300-\u036f]/g, '')
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-+|-+$/g, '')
	.slice(0, 48) || 'ufc-story';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const base = `${folder}/ufc-${stamp}-${slug}`;

return [
	{
		json: {
			...post,
			downloadsFolder: folder,
			fileBase: base,
			imagePath: `${base}.jpg`,
			captionPath: `${base}-caption.txt`,
			metaPath: `${base}-meta.json`,
		},
	},
];