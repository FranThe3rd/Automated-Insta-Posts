// Pick up to N stories whose image is a valid JPEG (N from Settings → exportsPerRun).
const settings = $('Settings').first().json;
const limit = Math.max(1, Math.min(10, Number(settings.exportsPerRun) || 5));

const posts = $('Build satire posts').all();
const checks = $('Check images').all();

const working = posts.filter((post, i) => {
	const check = checks[i]?.json ?? {};
	const type = String(check.headers?.['content-type'] ?? '');
	return check.statusCode === 200 && type.startsWith('image/jpeg');
});

return working.slice(0, limit).map((post) => ({ json: post.json }));