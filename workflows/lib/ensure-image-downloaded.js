// Keep export paths on the item and fail fast when the JPEG did not download.
const prep = $('Prepare export paths').first().json;
const item = $input.first();

if (!item.binary?.data) {
	throw new Error(
		`Image download failed for "${prep.title}". Check imageUrl in the previous node output.`,
	);
}

return [{ json: { ...prep }, binary: item.binary }];