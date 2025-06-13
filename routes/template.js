const express = require('express');
const router = express.Router();
const templateService = require('../services/template');

// GET /template/:name - retourne un template JSON depuis S3
router.get('/template/:name', async (req, res) => {
  try {
    const template = await templateService.getTemplateByName(req.params.name);
    if (template) {
      res.json(template);
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
