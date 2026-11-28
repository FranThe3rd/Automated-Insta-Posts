// Build post drafts from satire stories (image URLs + backup caption). No article HTML scrape.
const settings = $('Settings').first().json;
const stories = $input.all();

const proxied = (source, params) =>
	`https://images.weserv.nl/?url=${encodeURIComponent(source)}&${params}`;

const width = Math.round(Number(settings.imageWidth) || 1080);
const height = Math.round(Number(settings.imageHeight) || 1920);
const tags = String(settings.hashtags || '#ufc #mma #ufcnews #mixedmartialarts #fightnews')
	.toLowerCase()
	.split(/\s+/)
	.filter(Boolean)
	.slice(0, 5)
	.join(' ');

const posts = [];
for (const { json: story } of stories) {
	const title = story.title;
	const captionHeadline = String(story.captionHeadline || title).trim();
	const captionFacts = String(story.captionFacts || '').trim();
	const captionOutlet = String(story.captionOutlet || 'UFC News').trim();
	const captionBody =
		String(story.captionBody || '').trim() ||
		(captionFacts ? `${captionHeadline}\n\n${captionFacts}` : captionHeadline);

	posts.push({
		json: {
			...story,
			title,
			sourceImage: story.sourceImage,
			imageUrl: proxied(
				story.sourceImage,
				'w=1080&h=1080&fit=contain&cbg=000000&output=jpg&q=90',
			),
			photoUrl: proxied(story.sourceImage, `w=${width}&output=png`),
			backdropUrl: proxied(story.sourceImage, `w=${width}&h=${height}&fit=cover&blur=35&output=jpg&q=75`),
			captionBody,
			caption: `${captionBody}\n\nSource: ${captionOutlet}\n\n${tags}`,
		},
	});
}

return posts;