// Turn Ollama satire JSON into story items (with stock fight photos and dedup keys).
// When Ollama is not reachable, use built-in satire templates so the run still exports stories.
const reply = $input.first().json ?? {};
const requested = Number($('Build satire batch prompt').first().json.requestedCount) || 5;

const memory = $getWorkflowStaticData('global');
const seen = new Set([...(memory.postedKeys ?? []), ...(memory.skippedKeys ?? [])]);

const titleKey = (title) =>
	`title:${String(title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()}`;

// Generic MMA photos with no named fighters. The Catbox copies come from
// Wikimedia Commons, because Wikimedia rate-limits the weserv proxy.
const STOCK_PHOTOS = [
	'https://files.catbox.moe/nwot9o.jpg',
	'https://files.catbox.moe/kb2rfk.jpg',
	'https://files.catbox.moe/uuuse6.jpg',
	'https://files.catbox.moe/7x7k8f.jpg',
	'https://files.catbox.moe/z2job8.jpg',
	'https://files.catbox.moe/1f7a49.jpg',
	'https://files.catbox.moe/fh0vbo.jpg',
	'https://files.catbox.moe/77tb2d.jpg',
	'https://files.catbox.moe/tedgoe.jpg',
	'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1200&q=80',
	'https://images.unsplash.com/photo-1615117972428-28de67cda58e?w=1200&q=80',
	'https://images.unsplash.com/photo-1622599511051-16f55a1234d0?w=1200&q=80',
];
const photoOffset = Math.floor(Math.random() * STOCK_PHOTOS.length);

const tidy = (text) =>
	String(text ?? '')
		.replace(/\s+/g, ' ')
		.trim();

const FIGHTERS = [
	'Dusty "The Lawnmower" Kowalski',
	'Brock "Two Takedowns" Mendez',
	'Igor "Cardio Optional" Petrenko',
	'Tyler "Split Decision" Vance',
	'Marcus "The Clinch" Holloway-Smith',
	'Darnell "Visor Up" Pierce',
	'Shane "Calf Kick Victim" O\'Hara',
	'Rafael "Late Notice" Duarte',
	'Kenji "Weight Miss" Tanaka',
	'Vlad "The Accountant" Sokolov',
	'Jared "Wrestle Boxing" McCall',
	'Luis "Hot Sauce" Fernandez',
];

const OUTLETS = ['The Choke Wire', 'Cauliflower Daily', 'The Octagon Onion', 'Ground & Pound Gazette'];

const TEMPLATES = [
	[
		'{a} MISSES WEIGHT BY 4 POUNDS, BLAMES A VERY DENSE BANANA',
		'{a} came in heavy at the official weigh-ins and told reporters the fruit "felt like a pound on its own." Commission officials confirmed the banana was not tested. He will forfeit 20 percent of his purse and all of his potassium.',
	],
	[
		'{a} ASKS FOR RE-MATCH AGAINST THE CAGE DOOR AFTER LOSING THE WALK-OUT',
		'{a} tripped on the cage door during his entrance and now says the door "got lucky." His team filed an appeal with the commission. The door has not responded, but sources say it is open to the fight.',
	],
	[
		'{a} WINS SPLIT DECISION OVER {b}; ONE JUDGE WAS WATCHING THE PRELIMS',
		'Two judges scored the fight for {a}, while the third scored a fight that happened two hours earlier. The commission called the result "technically a decision." {b} says he will ask for a rematch and a new judge.',
	],
	[
		'{a} SAYS HE IS MOVING UP TWO WEIGHT CLASSES TO AVOID HIS OWN DIET',
		'{a} announced the move at a press conference while eating a burrito. "I am not running from anyone at my weight," he said. "I am running from salad." His coach said the cardio plan is "under review."',
	],
	[
		'{a} CALLS OUT {b}, THEN SPENDS THE POST-FIGHT INTERVIEW THANKING HIS LANDLORD',
		'{a} used half of his octagon interview to call out {b} and the other half to ask for an extension on rent. The crowd chanted the landlord\'s name. {b} has not accepted the fight but sent a moving company.',
	],
	[
		'{a} ACCEPTS FIGHT ON 30 MINUTES NOTICE, STILL MAKES WEIGHT BY SWEATING IN THE CAB',
		'{a} was in the arena parking lot when the call came. He made weight by running the heater in the taxi and walked out in borrowed shorts. The driver has asked for a share of the bonus.',
	],
	[
		'{a} TAPS TO A CALF KICK, SAYS IT WAS "A TACTICAL NAP"',
		'{a} went down from the third calf kick of the night and later told the media he was "resting for round two." There was no round two. {b} said he would give him a rematch "when his leg grows back confidence."',
	],
	[
		'{a} BLAMES LOSS ON MERCURY IN RETROGRADE AND THE REFEREE\'S HAIRCUT',
		'{a} lost every round on every scorecard and said the planets were "in a bad clinch." He also said the referee\'s new haircut threw off his depth perception. The commission does not plan to review the haircut.',
	],
	[
		'{a} SIGNS TO FIGHT {b} AND THE WINNER GETS TO PICK THE WALK-OUT SONG FOR THE LOSER',
		'Both fighters agreed to the terms at a heated press conference. {b} has already promised a children\'s song. {a} says he has one prepared that is "too dangerous for radio." Ticket sales went up 400 percent.',
	],
	[
		'{a} RETIRES FOR THE 7TH TIME, ANNOUNCES COMEBACK BEFORE THE PRESS CONFERENCE ENDS',
		'{a} told fans he was hanging up his gloves for good, then picked them back up "because they looked lonely." He now wants a fight with {b} in March. His manager has stopped printing retirement shirts.',
	],
	[
		'{a} SAYS HIS GAME PLAN AGAINST {b} IS "WRESTLE, THEN WRESTLE MORE, THEN MAYBE WRESTLE"',
		'{a} revealed his full strategy at open workouts and said he does not care who knows it. Analysts call the plan "simple but effective." {b} has started training on his back to save time.',
	],
	[
		'{a} FINED FOR CELEBRATING TOO HARD, KNOCKS OUT HIS OWN CORNERMAN',
		'{a} won by first-round knockout and then jumped the cage into his corner. The cornerman is fine but asked to be credited with the loss. The commission fined {a} for "unsanctioned bonus violence."',
	],
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const shuffled = (list) =>
	list
		.map((value) => ({ value, sort: Math.random() }))
		.sort((x, y) => x.sort - y.sort)
		.map(({ value }) => value);

// Each joke appears once per run. A new pair of names keeps it unique across runs.
function templateStories() {
	const out = [];
	for (const [headline, article] of shuffled(TEMPLATES)) {
		const a = pick(FIGHTERS);
		let b = pick(FIGHTERS);
		while (b === a) b = pick(FIGHTERS);
		const fill = (text) => text.replaceAll('{a}', a).replaceAll('{b}', b);
		out.push({ headline: fill(headline).toUpperCase(), article: fill(article), outlet: pick(OUTLETS) });
	}
	return out;
}

function ollamaStories() {
	if (reply.error) {
		const detail = typeof reply.error === 'string' ? reply.error : reply.error.message;
		throw new Error(detail || 'Ollama satire request failed');
	}
	const content = reply.message?.content ?? reply.response;
	if (!content) throw new Error('Ollama returned no satire stories');
	const parsed = typeof content === 'string' ? JSON.parse(content) : content;
	if (!Array.isArray(parsed.stories) || parsed.stories.length === 0) {
		throw new Error('Ollama returned an empty story list');
	}
	return parsed.stories;
}

let rawStories;
let storySource = 'ollama';
let storyError;
try {
	rawStories = ollamaStories();
} catch (error) {
	rawStories = templateStories();
	storySource = 'backup';
	storyError = error.message;
}

const stories = [];
const keysInRun = new Set();

for (const raw of rawStories) {
	const title = tidy(raw.headline);
	const snippet = tidy(raw.article);
	const outlet = tidy(raw.outlet) || 'The Choke Wire';
	const source = /satire/i.test(outlet) ? outlet : `${outlet} (Satire)`;
	if (!title || title.length < 12 || !snippet) continue;

	const keys = [titleKey(title)];
	if (keys.some((key) => seen.has(key) || keysInRun.has(key))) continue;
	keys.forEach((key) => keysInRun.add(key));

	const sourceImage = STOCK_PHOTOS[(photoOffset + stories.length) % STOCK_PHOTOS.length];
	const link = `https://satire.local/${encodeURIComponent(titleKey(title).slice(6, 80))}`;

	stories.push({
		json: {
			title,
			link,
			source,
			publishedAt: new Date().toISOString(),
			snippet,
			storyFacts: snippet,
			sourceImage,
			feedImage: sourceImage,
			keys,
			satire: true,
			storySource,
			...(storyError ? { storyError } : {}),
		},
	});
	if (stories.length >= requested) break;
}

if (stories.length === 0) throw new Error('No usable satire stories. All of them were exported before.');
return stories;
