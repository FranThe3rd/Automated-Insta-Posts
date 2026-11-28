// Keep the parody headline on the image; pair each item with a real RSS story for note.txt.
const satire = $('Parse satire stories').all();
const real = $('Build Instagram posts').all();
if (real.length === 0) {
	throw new Error('No real UFC stories for note.txt captions. Check RSS feeds and try again.');
}

return satire.map((item, i) => {
	const article = real[i % real.length].json;
	return {
		json: {
			...item.json,
			captionHeadline: article.title,
			captionFacts: article.storyFacts || '',
			captionOutlet: article.source,
			captionLink: article.link,
			captionBody: article.captionBody || '',
		},
	};
});