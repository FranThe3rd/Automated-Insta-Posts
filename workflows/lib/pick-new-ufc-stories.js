// Pick the newest UFC stories that this workflow has not posted or skipped yet.
const settings = $('Settings').first().json;
const feeds = $('News sources').all().map((item) => item.json);
const memory = $getWorkflowStaticData('global');
const seen = new Set([...(memory.postedKeys ?? []), ...(memory.skippedKeys ?? [])]);

const maxAgeMs = Number(settings.maxStoryAgeHours || 48) * 60 * 60 * 1000;
const candidateCount = 12;

// The Code node sandbox has no URL class, so read the host and path with a pattern.
const urlParts = (url) => {
	const match = String(url ?? '')
		.trim()
		.match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
	if (!match) return null;
	return {
		host: match[1]
			.replace(/^[^@]*@/, '')
			.replace(/:\d+$/, '')
			.replace(/^www\./i, '')
			.toLowerCase(),
		path: match[2],
	};
};

const host = (url) => urlParts(url)?.host ?? '';

const linkKey = (url) => {
	const parts = urlParts(url);
	if (!parts) return `link:${String(url).toLowerCase()}`;
	return `link:${parts.host}${parts.path.replace(/\/+$/, '')}`.toLowerCase();
};

const titleKey = (title) =>
	`title:${String(title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()}`;

const firstUrl = (value) => {
	if (!value) return '';
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return firstUrl(value[0]);
	return value.url || value.$?.url || value.href || '';
};

const looksLikeImage = (url) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);

const decodeUrl = (url) => String(url).replace(/&#0?38;|&amp;/g, '&');

function feedImage(item) {
	const enclosure = item.enclosure;
	if (enclosure?.url && (/^image\//.test(enclosure.type || '') || looksLikeImage(enclosure.url))) {
		return decodeUrl(enclosure.url);
	}
	const media = firstUrl(item['media:content']) || firstUrl(item['media:thumbnail']);
	if (media) return decodeUrl(media);
	const html = `${item['content:encoded'] || ''} ${item.content || ''}`;
	const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	return img ? decodeUrl(img[1]) : '';
}

const feedForLink = (link) => {
	const linkHost = host(link);
	if (!linkHost) return undefined;
	return feeds.find((feed) => {
		const feedHost = host(feed.url);
		if (!feedHost) return false;
		return (
			linkHost === feedHost || linkHost.endsWith(`.${feedHost}`) || feedHost.endsWith(`.${linkHost}`)
		);
	});
};

const now = Date.now();
const stories = [];
const keysInThisRun = new Set();

for (const { json: item } of $('Read news feeds').all()) {
	if (item.error || !item.title || !item.link) continue;

	const published = new Date(item.isoDate || item.pubDate || 0).getTime();
	if (!published || now - published > maxAgeMs || published > now + 60 * 60 * 1000) continue;

	const feed = feedForLink(item.link);
	const categories = Array.isArray(item.categories) ? item.categories.join(' ') : '';
	const text = `${item.title} ${categories} ${item.contentSnippet || ''} ${item.link}`;
	const hasUfc =
		feed?.allUfc ||
		/(^|[^a-z])ufc([^a-z]|$)/i.test(text) ||
		/\bultimate fighting championship\b/i.test(text) ||
		/\bufc\s*\d{2,4}\b/i.test(text);
	if (!hasUfc) continue;

	const nonUfcSport =
		/\b(wrestling|real american freestyle|\braf\b|wwe|bare knuckle|nhra|nba\b|nfl\b|mlb\b|ncaa wrestling)\b/i.test(
			text,
		);
	if (!feed?.allUfc && nonUfcSport && !/(^|[^a-z])ufc([^a-z]|$)/i.test(text)) continue;

	const keys = [linkKey(item.link), titleKey(item.title)];
	if (keys.some((key) => seen.has(key) || keysInThisRun.has(key))) continue;
	keys.forEach((key) => keysInThisRun.add(key));

	stories.push({
		title: String(item.title).trim(),
		link: item.link,
		source: feed?.name || host(item.link),
		publishedAt: new Date(published).toISOString(),
		snippet: String(item.contentSnippet || item.content || '').slice(0, 2000),
		feedImage: feedImage(item),
		keys,
	});
}

stories.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

return stories.slice(0, candidateCount).map((story) => ({ json: story }));