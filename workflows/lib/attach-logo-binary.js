// Merge the post JPEG with the logo file read from workflows/assets.
const post = $('Ensure image downloaded').first();
const logo = $input.first().binary?.logo;
if (!logo) {
	throw new Error(
		'Logo file missing. Run pnpm dev:up (copies the logo to ~/.n8n-files) or set Settings → logoFilePath.',
	);
}
return [
	{
		json: post.json,
		binary: {
			data: post.binary.data,
			logo,
		},
	},
];