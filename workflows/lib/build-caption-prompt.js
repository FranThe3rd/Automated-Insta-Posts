// Build the Ollama request for one exported story. This node runs once for each story.
const settings = $('Settings').first().json;
const post = $json;
const headline = String(post.captionHeadline ?? post.title ?? '').trim();
const articleText = String(post.captionFacts ?? post.storyFacts ?? post.title ?? '').trim();

const system = `You write Instagram captions for a UFC news page. Fight fans read them on their phones.

Write like a fan who knows the sport: direct, clear, and natural. Use only the facts in the article text. Never add records, dates, quotes, results, or opinions that are not in the article text. If the article text is thin, write less.

Answer with JSON that has these fields:
- "hook": one sentence of 8 to 16 words that says what happened. Use your own words. It is not a question and it is not clickbait.
- "body": 2 or 3 sentences, 40 to 70 words in total. Give the key details and what comes next. Do not repeat the hook.
- "question": one short question that asks fans what they think about this story.
- "fighters": the full names of the fighters in the headline, 3 at most.

Rules for the text: no hashtags, no emojis, no links, no outlet or author names, no dates of publication. Do not start with "In a", "Breaking", or "It's official". Use contractions.`;

const user = `Headline: ${headline}

Article text:
${articleText}`;

const ollamaRequest = {
	model: String(settings.ollamaModel || 'llama3.2'),
	stream: false,
	messages: [
		{ role: 'system', content: system },
		{ role: 'user', content: user },
	],
	// A JSON schema keeps a small local model from adding a preamble or markdown.
	format: {
		type: 'object',
		properties: {
			hook: { type: 'string' },
			body: { type: 'string' },
			question: { type: 'string' },
			fighters: { type: 'array', items: { type: 'string' } },
		},
		required: ['hook', 'body', 'question', 'fighters'],
	},
	// A low temperature keeps the text close to the article.
	options: { temperature: 0.3, top_p: 0.9, num_predict: 400, num_ctx: 4096 },
};

return { json: { ...post, ollamaRequest } };
