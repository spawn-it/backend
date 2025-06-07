const { getFile } = require('./s3');
const TEMPLATE_BUCKET = 'spawn-it-bucket';
const TEMPLATE_PREFIX = 'templates/';

async function getTemplateByName(name) {
    const key = `${TEMPLATE_PREFIX}${name}`;
    try {
        const content = await getFile(TEMPLATE_BUCKET, key);
        console.log(`[DEBUG TEMPLATE SVC] Raw content for ${key}:`, content);
        const parsedContent = JSON.parse(content);
        console.log(`[DEBUG TEMPLATE SVC] Parsed content for ${key}:`, JSON.stringify(parsedContent, null, 2));
        return parsedContent;
    } catch (err) {
        if (err.code === 'NoSuchKey') {
            return null;
        }
        throw err;
    }
}

module.exports = {
    getTemplateByName,
};
