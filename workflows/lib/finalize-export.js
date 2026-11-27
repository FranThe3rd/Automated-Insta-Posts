// Build caption + meta binaries while keeping export paths on json (Convert to File clears json).
const post = $json;
const caption = String(post.caption ?? '').trim() || '(No caption generated — check Ollama.)';

const payload = {
	title: post.title,
	link: post.link,
	source: post.source,
	publishedAt: post.publishedAt,
	imageUrl: post.imageUrl,
	sourceImage: post.sourceImage,
	caption,
	savedImage: post.imagePath,
	savedCaption: post.captionPath,
	exportedAt: new Date().toISOString(),
};
const metaText = JSON.stringify(payload, null, 2);

const baseName = String(post.fileBase ?? 'ufc-export').split('/').pop();

const toBinary = (text, mimeType, fileName) => ({
	data: Buffer.from(text, 'utf8').toString('base64'),
	mimeType,
	fileName,
});

return [
	{
		json: { ...post, caption, metaText },
		binary: {
			captionFile: toBinary(caption, 'text/plain', `${baseName}-caption.txt`),
			metaFile: toBinary(metaText, 'application/json', `${baseName}-meta.json`),
		},
	},
];