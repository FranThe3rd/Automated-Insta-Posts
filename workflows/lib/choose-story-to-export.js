// Pick the newest story whose image is a valid JPEG.
const posts = $('Build Instagram posts').all();
const checks = $('Check images').all();

const working = posts.filter((post, i) => {
	const check = checks[i]?.json ?? {};
	const type = String(check.headers?.['content-type'] ?? '');
	return check.statusCode === 200 && type.startsWith('image/jpeg');
});

const post = working[0];
return post ? [{ json: post.json }] : [];