// Remember the story so the next run picks a different one.
const post = $('Prepare export paths').first().json;
const memory = $getWorkflowStaticData('global');
memory.postedKeys = [...(memory.postedKeys ?? []), ...post.keys].slice(-2000);

return [
	{
		json: {
			exported: true,
			imagePath: post.imagePath,
			captionPath: post.captionPath,
			metaPath: post.metaPath,
			title: post.title,
			link: post.link,
			exportedAt: new Date().toISOString(),
		},
	},
];