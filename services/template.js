/**
 * Template Service for managing OpenTofu/Terraform templates
 * Handles template retrieval from S3 storage
 */
const s3Service = require('./s3/S3Service');

class TemplateService {
    constructor() {
        this.templateBucket = process.env.S3_BUCKET || 'spawn-it-bucket';
        this.templatePrefix = 'templates/';
    }

    /**
     * Retrieves a template by name from S3 storage
     * @param {string} name - Template name (filename)
     * @returns {Promise<Object|null>} Parsed template object or null if not found
     * @throws {Error} If template exists but cannot be parsed
     */
    async getTemplateByName(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        const key = `${this.templatePrefix}${name}`;

        try {
            const content = await s3Service.getFile(this.templateBucket, key);
            return JSON.parse(content);
        } catch (err) {
            if (err.code === 'NoSuchKey') {
                return null;
            }
            throw err;
        }
    }
}

module.exports = new TemplateService();