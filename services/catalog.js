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

function getAllServicesFlat() {
    const catalog = loadCatalog();
    return catalog.flatMap(category => category.items);
}

module.exports = {
    // Get all services grouped by category
    getAllServices: () => {
        return loadCatalog();
    },

    _getAllServicesFlat: getAllServicesFlat,

    getServiceByName: (name) => {
        return getAllServicesFlat().find((s) => s.name === name) || null;
    },

    getTemplateFileByName: (name) => {
        const service = getAllServicesFlat().find((s) => s.name === name);
        return service ? service.template_file : null;
    },

    getImagePathByName: (name) => {
        const service = getAllServicesFlat().find((s) => s.name === name);
        return service ? service.image_path : null;
    }
};
