// Turn each picked story into a post draft: clean article facts, image links, and a backup caption.
// The AI caption is written later for each story that gets exported.
const settings = $('Settings').first().json;
const stories = $('Pick new UFC stories').all();
const pages = $input.all();

const NAMED_ENTITIES = {
	amp: '&',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	lt: '<',
	gt: '>',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	hellip: '…',
	ndash: '–',
	mdash: '—',
};

const codePoint = (value) =>
	value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';

const decode = (text) =>
	String(text ?? '')
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
		.replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);

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

const stripTags = (html) =>
	String(html ?? '')
		.replace(/<(script|style|noscript|figure|figcaption|iframe|svg|form|button)\b[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<[^>]+>/g, ' ');

function cleanText(text) {
	return decode(stripTags(text))
		.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')
		.replace(/The post .* appeared first on .*$/is, '')
		.replace(/Read the Full Article Here/gi, ' ')
		.replace(/\bAdvertisement\b/g, ' ')
		.replace(/\s*\[(?:…|\.\.\.)\]\s*$/, '…')
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

const PAGE_CHROME =
	/(cookie|privacy policy|terms of (use|service)|newsletter|subscribe|sign up|sign in|log in|follow (us|me|him|her)\b|all rights reserved|©|click here|download the app|getty images|photo (by|credit)|image credit|read more|related:|share this|leave a comment|join the conversation|affiliate|sportsbook|promo code|odds (via|by))/i;

const SOCIAL_EMBED =
	/<blockquote\b[^>]*class\s*=\s*["'][^"']*(twitter|instagram|tiktok|bluesky)[^"']*["'][\s\S]*?<\/blockquote>/gi;

// Split the article into text blocks. Some sites use <p>, others use <br> between paragraphs.
function articleBlocks(html) {
	if (typeof html !== 'string') return [];
	const scope =
		html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
	return scope
		.replace(/\s+/g, ' ')
		.replace(/<(script|style|noscript|figure|figcaption|iframe|svg|form|button|nav|aside|footer)\b[\s\S]*?<\/\1>/gi, '\n')
		.replace(SOCIAL_EMBED, '\n')
		.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|blockquote|section|tr)>/gi, '\n')
		.split('\n')
		.map(cleanText)
		.filter((block) => block.length >= 60 && !PAGE_CHROME.test(block));
}

const ABBREVIATION = /\b(vs|jr|sr|mr|mrs|ms|dr|st|no|u\.s|u\.k|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.$/i;

function sentences(text) {
	const pieces = String(text)
		.split(/(?<=[.!?…]["'”’)]?)\s+(?=["'“‘(]?[A-Z0-9])/)
		.map((piece) => piece.trim())
		.filter(Boolean);
	const out = [];
	for (const piece of pieces) {
		const last = out[out.length - 1];
		if (last && ABBREVIATION.test(last)) out[out.length - 1] = `${last} ${piece}`;
		else out.push(piece);
	}
	return out;
}

const fingerprint = (text) =>
	String(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

// A whole sentence ends with a full stop, a question mark, or an exclamation mark.
// Subheadings and summaries that a site cut short do not.
const isWhole = (sentence) => /[.!?]["'”’)\]]*$/.test(sentence) && !/(…|\.\.\.)["'”’)\]]*$/.test(sentence);

// Collect unique, whole sentences about the story, best source first.
function storyFacts(story, html) {
	const title = decode(story.title).trim();
	const titlePrint = fingerprint(title);
	const seen = new Set([titlePrint]);
	const facts = [];

	const add = (text, { anySentence = false } = {}) => {
		const withoutTitle = title ? String(text).split(title).join(' ') : String(text);
		for (const sentence of sentences(cleanText(withoutTitle))) {
			const print = fingerprint(sentence);
			if (print.length < 25 || seen.has(print) || titlePrint.includes(print)) continue;
			if (!anySentence && !isWhole(sentence)) continue;
			if (PAGE_CHROME.test(sentence)) continue;
			seen.add(print);
			facts.push(sentence);
		}
	};

	add(pageSummary(html));
	for (const block of articleBlocks(html)) add(block);
	if (facts.join(' ').length < 240) add(story.snippet);
	if (facts.length === 0) add(pageSummary(html) || story.snippet, { anySentence: true });
	return facts;
}

// Join whole sentences until the limit; never stop in the middle of a word.
function joinUpTo(parts, max) {
	let text = '';
	for (const part of parts) {
		const next = text ? `${text} ${part}` : part;
		if (next.length > max) break;
		text = next;
	}
	if (text || parts.length === 0) return text;
	const cut = parts[0].slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).trim()}…`;
}

function backupCaption(title, facts) {
	const detail = joinUpTo(facts, 420);
	return detail ? `${title}\n\n${detail}` : title;
}

const proxied = (source, params) =>
	`https://images.weserv.nl/?url=${encodeURIComponent(source)}&${params}`;

function instagramImage(source) {
	const url = proxied(source, 'w=1080&h=1080&fit=contain&cbg=000000&output=jpg&q=90');
	const localLogo = String(settings.logoFilePath || '').trim();
	if (localLogo) return url;
	const logo = String(settings.logoPublicUrl || '').trim();
	if (!logo || logo.includes('PASTE_PUBLIC')) return url;
	const scale = Number(settings.logoMarkScale || 14);
	const pad = Number(settings.logoMarkPad || 22);
	return `${url}&mark=${encodeURIComponent(logo)}&markpos=bottom-right&markpad=${pad}&markscale=${scale}`;
}

const width = Math.round(Number(settings.imageWidth) || 1080);
const height = Math.round(Number(settings.imageHeight) || 1920);
const tags = String(settings.hashtags || '#ufc #mma #ufcnews #mixedmartialarts #fightnews')
	.toLowerCase()
	.split(/\s+/)
	.filter(Boolean)
	.slice(0, 5)
	.join(' ');

const posts = [];
for (let i = 0; i < stories.length; i++) {
	const story = stories[i].json;
	const html = pages[i]?.json?.data;
	const sourceImage = pageImage(html) || story.feedImage;
	if (!sourceImage) continue;

	const title = decode(story.title).replace(/\s+/g, ' ').trim();
	const facts = storyFacts(story, html);
	const captionBody = backupCaption(title, facts);

	posts.push({
		json: {
			...story,
			title,
			sourceImage,
			imageUrl: instagramImage(sourceImage),
			// Sharp photo at full width, and a blurred copy that fills the whole frame behind it.
			photoUrl: proxied(sourceImage, `w=${width}&output=png`),
			backdropUrl: proxied(sourceImage, `w=${width}&h=${height}&fit=cover&blur=35&output=jpg&q=75`),
			storyFacts: joinUpTo(facts, 1800),
			captionBody,
			caption: `${captionBody}\n\nSource: ${story.source}\n\n${tags}`,
			captionSource: 'backup',
		},
	});
}

return posts;
