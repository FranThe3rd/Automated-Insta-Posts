// Remember each exported story so the next run skips them.
const post = $json;
const memory = $getWorkflowStaticData('global');
const keys = Array.isArray(post.keys) ? post.keys : [];
memory.postedKeys = [...(memory.postedKeys ?? []), ...keys].slice(-2000);

return {
	json: {
		exported: true,
		exportDir: post.exportDir,
		imagePath: post.imagePath,
		captionPath: post.captionPath,
		metaPath: post.metaPath,
		title: post.title,
		link: post.link,
		exportedAt: new Date().toISOString(),
	},
};