const express = require('express');
const router = express.Router();
const catalog = require('../services/CatalogService');

// GET /catalog - liste de tous les services
router.get('/catalog', (req, res) => {
  const all = catalog.getAllServices();
  res.json(all);
});

// GET /catalog/:name - détails complets d’un service
router.get('/catalog/:name', (req, res) => {
  const service = catalog.getServiceByName(req.params.name);
  if (service) {
    res.json(service);
  } else {
    res.status(404).json({ error: 'Service not found' });
  }
});

// GET /catalog/:name/template - chemin du fichier template
router.get('/catalog/:name/template', (req, res) => {
  const file = catalog.getTemplateFileByName(req.params.name);
  if (file) {
    res.json({ template_file: file });
  } else {
    res.status(404).json({ error: 'Template file not found' });
  }
});

// GET /catalog/:name/image - chemin de l’image
router.get('/catalog/:name/image', (req, res) => {
  const image = catalog.getImagePathByName(req.params.name);
  if (image) {
    res.json({ image_path: image });
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// GET /catalog/category/:id - services d'une catégorie
router.get('/catalog/category/:id', (req, res) => {
  const categoryId = req.params.id;
  const categories = catalog.getAllServices();
  const category = categories.find((cat) => cat.id === categoryId);
  if (category) {
    res.json(category.items);
  } else {
    res.status(404).json({ error: 'Category not found' });
  }
});

module.exports = router;
