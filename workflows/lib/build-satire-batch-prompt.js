// One Ollama call generates every satire story for this run (Settings → exportsPerRun).
const settings = $('Settings').first().json;
const count = Math.max(1, Math.min(10, Number(settings.exportsPerRun) || 5));

const system = `You write obvious MMA parody headlines for a satire account. Fans should never think the story is real.

Humor rules:
- Sound like fight Twitter and clickbait, but the premise must be absurd yet grounded in MMA logic (weight cuts, press conferences, USADA, Dana White, gloves, rematches, cage door memes, cauliflower ear, etc.).
- Invent fighter names or use playful twists on real types — do not present fake quotes from real people as if they are real.
- Each headline is ALL CAPS energy but grammatical. One headline only, 8–18 words.
- Each article is 2–4 short sentences of fake detail that matches the headline.
- Never mention real injuries, arrests, or tragedies. No politics. No slurs.

Return JSON only.`;

const user = `Write exactly ${count} different satirical MMA news items. Make each one unique for this run.`;

const ollamaRequest = {
	model: String(settings.ollamaModel || 'llama3.2'),
	stream: false,
	messages: [
		{ role: 'system', content: system },
		{ role: 'user', content: user },
	],
	format: {
		type: 'object',
		properties: {
			stories: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						headline: { type: 'string' },
						article: { type: 'string' },
						outlet: { type: 'string' },
					},
					required: ['headline', 'article', 'outlet'],
				},
			},
		},
		required: ['stories'],
	},
	options: { temperature: 0.85, top_p: 0.92, num_predict: 2200, num_ctx: 8192 },
};

return [{ json: { ollamaRequest, requestedCount: count } }];