// Build caption + meta binaries while keeping export paths on json (Convert to File clears json).
const post = $json;
const caption = String(post.caption ?? '').trim() || '(No caption generated — check Ollama.)';

const payload = {
	title: post.title,
	link: post.link,
	source: post.source,
	publishedAt: post.publishedAt,
	sourceImage: post.sourceImage,
	photoUrl: post.photoUrl,
	backdropUrl: post.backdropUrl,
	imageSize: post.layout ? `${post.layout.width}x${post.layout.height}` : undefined,
	caption,
	captionSource: post.captionSource,
	captionError: post.captionError,
	exportDir: post.exportDir,
	exportId: post.exportId,
	savedImage: post.imagePath,
	savedCaption: post.captionPath,
	exportedAt: new Date().toISOString(),
};
const metaText = JSON.stringify(payload, null, 2);

const toBinary = (text, mimeType, fileName) => ({
	data: Buffer.from(text, 'utf8').toString('base64'),
	mimeType,
	fileName,
});

return [
	{
		json: { ...post, caption, metaText },
		binary: {
			captionFile: toBinary(caption, 'text/plain', 'note.txt'),
			metaFile: toBinary(metaText, 'application/json', 'data.json'),
		},
	},
];