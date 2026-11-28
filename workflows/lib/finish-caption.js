// Clean the Ollama answer and assemble the caption. Use the backup caption when Ollama gave nothing usable.
const settings = $('Settings').first().json;
const { ollamaRequest, ...post } = $('Build caption prompt').item.json;
const reply = $input.item.json ?? {};

const headline = String(post.captionHeadline ?? post.title ?? '').trim();
const articleText = String(post.captionFacts ?? post.storyFacts ?? '').trim();
const outlet = String(post.captionOutlet ?? post.source ?? 'UFC News').trim();
const storyLink = String(post.captionLink ?? post.link ?? '').trim();

const tidy = (value) =>
	String(value ?? '')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/#[\p{L}\p{N}_]+/gu, ' ')
		.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')
		.replace(/[*_`]+/g, '')
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^["“”']+|["“”']+$/g, '')
		.trim();

const plain = (text) =>
	String(text)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

// A small local model sometimes adds claims that the article does not make. Keep a sentence only
// when most of its words, and all of its numbers and names, come from the article.
const article = plain(`${headline} ${articleText}`);
const COMMON_WORDS = new Set(
	`about after again also always been before being both could does doing down each even ever every
	fans from have having here into just know like make many more most much must need next only other
	over really said same says should some still such sure take than that their them then there these
	they thing think this those very want what when where which while will with would your`.split(/\s+/),
);
const stems = (text) =>
	(plain(text).match(/[a-z0-9]+/g) ?? [])
		.filter((word) => word.length > 3 && !COMMON_WORDS.has(word))
		.map((word) => word.slice(0, 5));
const articleStems = new Set(stems(article));

function fromArticle(sentence, minShare) {
	const numbers = sentence.match(/\d[\d,.:-]*\d|\d/g) ?? [];
	if (numbers.some((number) => !article.includes(number))) return false;
	// A capital letter after the first word marks a name.
	const names = sentence.split(/\s+/).slice(1).filter((word) => /^[A-Z][a-z]{2,}/.test(word));
	if (names.some((name) => !article.includes(plain(name.replace(/[^\p{L}].*$/u, ''))))) return false;
	const words = stems(sentence);
	if (words.length === 0) return true;
	return words.filter((word) => articleStems.has(word)).length / words.length >= minShare;
}

const splitSentences = (text) => text.split(/(?<=[.!?]["”’)]?)\s+/).filter(Boolean);

function readAnswer() {
	if (reply.error) {
		const detail = typeof reply.error === 'string' ? reply.error : reply.error.message;
		throw new Error(detail || 'Ollama request failed');
	}
	const content = reply.message?.content ?? reply.response;
	if (!content) throw new Error('Ollama returned no text');
	const answer = typeof content === 'string' ? JSON.parse(content) : content;

	const hook = tidy(answer.hook);
	const question = tidy(answer.question);
	const body = splitSentences(tidy(answer.body))
		.map((sentence) => sentence.trim())
		.filter((sentence) => !sentence.endsWith('?') && fromArticle(sentence, 0.6))
		.join(' ');
	if (body.length < 80 || body.length > 900) {
		throw new Error('Ollama text did not match the article closely enough');
	}

	const hookFits = hook.length >= 15 && hook.length <= 200 && fromArticle(hook, 0.6);
	const questionFits =
		question.endsWith('?') && question.length >= 15 && question.length <= 180 && fromArticle(question, 0.4);

	return {
		hook: hookFits ? hook.replace(/([^.!?])$/, '$1.') : headline,
		body,
		question: questionFits ? question : '',
		fighters: Array.isArray(answer.fighters) ? answer.fighters : [],
	};
}

// Keep a name tag only when the article really names that person. Names in the headline come
// first. When the headline has no name, one name from the article is enough.
function nameTags(fighters) {
	const headlinePlain = plain(headline);
	const inHeadline = [];
	const inArticle = [];
	for (const fighter of fighters) {
		const name = tidy(fighter);
		const words = name.split(' ');
		if (words.length < 2 || words.length > 4 || !article.includes(plain(name))) continue;
		const tag = `#${plain(name).replace(/[^a-z0-9]/g, '')}`;
		const list = headlinePlain.includes(plain(name)) ? inHeadline : inArticle;
		if (tag.length > 3 && !list.includes(tag)) list.push(tag);
	}
	return inHeadline.length > 0 ? inHeadline.slice(0, 3) : inArticle.slice(0, 1);
}

function eventTags() {
	const tags = [];
	const numbered = headline.match(/\bUFC\s?(\d{3})\b/i);
	if (numbered) tags.push(`#ufc${numbered[1]}`);
	if (/\bUFC Fight Night\b/i.test(headline)) tags.push('#ufcfightnight');
	return tags;
}

// Closes the caption when the model gave no usable question.
const OPEN_QUESTION = 'What’s your take? Tell us in the comments.';

let parts;
let captionSource = 'ollama';
let captionError;
let extraTags = eventTags();

try {
	const answer = readAnswer();
	parts = [answer.hook, answer.body, answer.question || OPEN_QUESTION];
	extraTags = [...nameTags(answer.fighters), ...extraTags];
} catch (error) {
	// The export continues with the backup text. data.json records why.
	parts = [post.captionBody || headline, OPEN_QUESTION];
	captionSource = 'backup';
	captionError = error.message;
}

// Instagram allows at most five hashtags per post.
const MAX_HASHTAGS = 5;
const baseTags = String(settings.hashtags || '#ufc #mma #ufcnews #mixedmartialarts #fightnews')
	.toLowerCase()
	.split(/\s+/)
	.filter(Boolean);
const hashtags = [...new Set([...baseTags, ...extraTags])].slice(0, MAX_HASHTAGS).join(' ');

const credit = [`Source: ${outlet}`];
if (settings.includeLinkInCaption && storyLink) credit.push(`Full story: ${storyLink}`);

const caption = [...parts, credit.join('\n'), hashtags].join('\n\n');

return {
	json: {
		...post,
		caption,
		captionSource,
		...(captionError ? { captionError } : {}),
	},
};
