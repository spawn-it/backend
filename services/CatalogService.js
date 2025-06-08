/**
 * Catalog Service for managing service templates and configurations
 * Provides efficient access to service catalog with caching mechanism
 */
const fs = require('fs');
const path = require('path');

class CatalogService {
    constructor() {
        this.catalogPath = path.join(__dirname, '../data/catalog.json');
        this.catalogCache = null;
    }

    /**
     * Loads and caches the service catalog from JSON file
     * @private
     * @returns {Array} Parsed catalog data
     * @throws {Error} If catalog file cannot be read or parsed
     */
    _loadCatalog() {
        if (this.catalogCache) {
            return this.catalogCache;
        }

        try {
            const rawData = fs.readFileSync(this.catalogPath, 'utf8');
            this.catalogCache = JSON.parse(rawData);
            return this.catalogCache;
        } catch (err) {
            console.error('[CatalogService] Failed to load catalog:', err.message);
            throw new Error(`Unable to load service catalog: ${err.message}`);
        }
    }

    /**
     * Flattens all services from all categories into a single array
     * @private
     * @returns {Array} Flat array of all services
     */
    _getAllServicesFlat() {
        const catalog = this._loadCatalog();
        return catalog.flatMap(category => category.items || []);
    }

    /**
     * Gets all services grouped by category
     * @returns {Array} Complete catalog with categories and services
     */
    getAllServices() {
        return this._loadCatalog();
    }

    /**
     * Finds a service by its name
     * @param {string} name - Service name to search for
     * @returns {Object|null} Service object or null if not found
     */
    getServiceByName(name) {
        if (!name || typeof name !== 'string') {
            return null;
        }

        const services = this._getAllServicesFlat();
        return services.find(service => service.name === name) || null;
    }

    /**
     * Gets the template file path for a service by name
     * @param {string} name - Service name
     * @returns {string|null} Template file path or null if not found
     */
    getTemplateFileByName(name) {
        const service = this.getServiceByName(name);
        return service?.template_file || null;
    }

    /**
     * Gets the image path for a service by name
     * @param {string} name - Service name
     * @returns {string|null} Image path or null if not found
     */
    getImagePathByName(name) {
        const service = this.getServiceByName(name);
        return service?.image_path || null;
    }

    /**
     * Gets service configuration by name
     * @param {string} name - Service name
     * @returns {Object|null} Service configuration object or null if not found
     */
    getServiceConfig(name) {
        const service = this.getServiceByName(name);
        if (!service) {
            return null;
        }

        return {
            name: service.name,
            description: service.description,
            templateFile: service.template_file,
            imagePath: service.image_path,
            category: this._getServiceCategory(name),
            config: service.config || {}
        };
    }

    /**
     * Gets all services in a specific category
     * @param {string} categoryName - Category name to filter by
     * @returns {Array} Array of services in the category
     */
    getServicesByCategory(categoryName) {
        if (!categoryName || typeof categoryName !== 'string') {
            return [];
        }

        const catalog = this._loadCatalog();
        const category = catalog.find(cat => cat.name === categoryName);
        return category?.items || [];
    }

    /**
     * Gets all available categories
     * @returns {Array} Array of category names
     */
    getCategories() {
        const catalog = this._loadCatalog();
        return catalog.map(category => ({
            name: category.name,
            description: category.description || '',
            serviceCount: category.items?.length || 0
        }));
    }

    /**
     * Validates if a service exists in the catalog
     * @param {string} name - Service name to validate
     * @returns {boolean} True if service exists
     */
    serviceExists(name) {
        return this.getServiceByName(name) !== null;
    }

    /**
     * Searches services by partial name match
     * @param {string} searchTerm - Term to search for
     * @returns {Array} Array of matching services
     */
    searchServices(searchTerm) {
        if (!searchTerm || typeof searchTerm !== 'string') {
            return [];
        }

        const services = this._getAllServicesFlat();
        const lowerSearchTerm = searchTerm.toLowerCase();

        return services.filter(service =>
            service.name?.toLowerCase().includes(lowerSearchTerm) ||
            service.description?.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Finds the category of a specific service
     * @private
     * @param {string} serviceName - Name of the service
     * @returns {string|null} Category name or null if not found
     */
    _getServiceCategory(serviceName) {
        const catalog = this._loadCatalog();

        for (const category of catalog) {
            if (category.items?.some(item => item.name === serviceName)) {
                return category.name;
            }
        }

        return null;
    }

    /**
     * Clears the internal cache (useful for testing or reloading)
     * @returns {void}
     */
    clearCache() {
        this.catalogCache = null;
    }

    /**
     * Reloads the catalog from disk
     * @returns {Array} Freshly loaded catalog
     */
    reloadCatalog() {
        this.clearCache();
        return this._loadCatalog();
    }
}

// Export singleton instance
module.exports = new CatalogService();