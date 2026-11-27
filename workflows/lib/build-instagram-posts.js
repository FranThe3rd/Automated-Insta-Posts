// Build Instagram posts with Ollama captions and a bottom-right logo watermark.
const settings = $('Settings').first().json;
const stories = $('Pick new UFC stories').all();
const pages = $input.all();

const decode = (text) =>
	String(text)
		.replace(/&amp;|&#0?38;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&#8217;/g, '’')
		.replace(/&#8216;/g, '‘')
		.replace(/&#8220;/g, '“')
		.replace(/&#8221;/g, '”')
		.replace(/&#8230;/g, '…')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');

function metaContent(html, names) {
	if (typeof html !== 'string') return '';
	for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
		const name = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
		if (!names.includes(name)) continue;
		const content = tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i);
		const value = content?.[1] ?? content?.[2];
		if (value) return decode(value).trim();
	}
	return '';
}

function pageImage(html) {
	const url = metaContent(html, ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
	return /^https?:\/\//i.test(url) ? url : '';
}

const pageSummary = (html) => metaContent(html, ['og:description', 'description', 'twitter:description']);

function cleanSnippet(text) {
	return decode(text)
		.replace(/The post .* appeared first on .*$/is, '')
		.replace(/Read the Full Article Here/gi, '')
		.replace(/\s*\[(?:…|\.\.\.)\]\s*$/, '…')
		.replace(/\s+/g, ' ')
		.trim();
}

function shorten(text, max) {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim()}…`;
}

function fallbackCaption(story, html) {
	const title = decode(story.title);
	const snippet = shorten(cleanSnippet(pageSummary(html) || story.snippet), 500);
	return snippet && snippet !== title ? `${title}\n\n${snippet}` : title;
}

function instagramImage(source) {
	let url = `https://images.weserv.nl/?url=${encodeURIComponent(source)}&w=1080&h=1080&fit=contain&cbg=000000&output=jpg&q=90`;
	const localLogo = String(settings.logoFilePath || '').trim();
	if (localLogo) return url;
	const logo = String(settings.logoPublicUrl || '').trim();
	if (!logo || logo.includes('PASTE_PUBLIC')) return url;
	const scale = Number(settings.logoMarkScale || 14);
	const pad = Number(settings.logoMarkPad || 22);
	return `${url}&mark=${encodeURIComponent(logo)}&markpos=bottom-right&markpad=${pad}&markscale=${scale}`;
}

async function ollamaCaption(story, html) {
	const base = String(settings.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
	const model = String(settings.ollamaModel || 'llama3.2');
	const summary = shorten(cleanSnippet(pageSummary(html) || story.snippet), 700);
	const prompt = `Write an Instagram caption for a UFC news post.

Headline: ${decode(story.title)}
Summary: ${summary}
Source: ${story.source}

Rules:
- Two short paragraphs, under 120 words total.
- Energetic fight-fan voice.
- Use only facts from the headline and summary.
- No hashtags, no emojis, no bullet lists.
- Do not mention Instagram.`;

	try {
		const res = await fetch(`${base}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				prompt,
				stream: false,
				options: { temperature: 0.65, num_predict: 240 },
			}),
			signal: AbortSignal.timeout(90000),
		});
		if (!res.ok) throw new Error(`ollama ${res.status}`);
		const data = await res.json();
		const text = String(data.response || '').trim();
		return text || fallbackCaption(story, html);
	} catch {
		return fallbackCaption(story, html);
	}
}

return (async () => {
	const posts = [];
	for (let i = 0; i < stories.length; i++) {
		const story = stories[i].json;
		const html = pages[i]?.json?.data;
		const sourceImage = pageImage(html) || story.feedImage;
		if (!sourceImage) continue;

		const body = await ollamaCaption(story, html);
		const tags = String(settings.hashtags || '#ufc #mma #ufcnews #mixedmartialarts #fightnews')
			.toLowerCase()
			.trim();
		const footer = [`Source: ${story.source}`, `Full story: ${story.link}`, '', tags].join('\n').trim();
		const caption = shorten(body, 2200 - footer.length - 4) + `\n\n${footer}`;

		posts.push({
			json: {
				...story,
				sourceImage,
				imageUrl: instagramImage(sourceImage),
				caption,
			},
		});
	}
	return posts;
})();