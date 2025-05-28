const { getFile } = require('./s3');
const TEMPLATE_BUCKET = 'spawn-it-bucket';
const TEMPLATE_PREFIX = 'templates/';

async function getTemplateByName(name) {
    const key = `${TEMPLATE_PREFIX}${name}`;
    try {
        const content = await getFile(TEMPLATE_BUCKET, key);
        return JSON.parse(content);
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
