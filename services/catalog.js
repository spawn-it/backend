const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../data/catalog.json');

let catalogCache = null;
function loadCatalog() {
    if (!catalogCache) {
        const raw = fs.readFileSync(catalogPath, 'utf8');
        catalogCache = JSON.parse(raw);
    }
    return catalogCache;
}

module.exports = {
    // Get all services
    getAllServices: () => {
        return loadCatalog();
    },

    // Get a service by name
    getServiceByName: (name) => {
        return loadCatalog().find((s) => s.name === name) || null;
    },

    // Get the template file path by service name
    getTemplateFileByName: (name) => {
        const service = loadCatalog().find((s) => s.name === name);
        return service ? service.template_file : null;
    },

    // Get the image path by service name
    getImagePathByName: (name) => {
        const service = loadCatalog().find((s) => s.name === name);
        return service ? service.image_path : null;
    }
};
