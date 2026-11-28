// Local dev only: read logo once, attach to every story item (needs NODE_FUNCTION_ALLOW_BUILTIN=fs).
const fs = require('fs');

const settings = $('Settings').first().json;

const repoLogo =
	'/Users/figueroaf/Desktop/Projects/Automated-Insta-Posts/workflows/assets/fw-logo-black-bg.png';
const homeLogo = '/Users/figueroaf/.n8n-files/fw-logo-black-bg.png';

const primary = String(settings.logoFilePath || '').trim() || homeLogo;
const backup = primary === homeLogo ? repoLogo : homeLogo;

let logoPath;
if (fs.existsSync(primary)) {
	logoPath = primary;
} else if (fs.existsSync(backup)) {
	logoPath = backup;
} else {
	throw new Error(`Logo not found. Checked:\n${primary}\n${backup}\nRun pnpm dev:up to copy the logo.`);
}

const logoBuffer = fs.readFileSync(logoPath);
const logoBinary = {
	data: logoBuffer.toString('base64'),
	mimeType: 'image/png',
	fileName: 'fw-logo-black-bg.png',
	fileExtension: 'png',
};

return $input.all().map((prep) => ({
	json: { ...prep.json, logoUsedPath: logoPath },
	binary: {
		...prep.binary,
		logo: logoBinary,
	},
}));