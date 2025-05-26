const express = require('express');
const router = express.Router();
const deployment = require('../services/spawnIt');
const { registerClient, removeClient } = require('../sse/clients');
const bucketName = process.env.S3_BUCKET;

router.get('/buckets', async (req, res) => {
  try {
    const buckets = await deployment.listBuckets();
    res.json({ buckets });
  } catch (err) {
    console.error('Erreur listage buckets :', err);
    res.status(500).json({ error: 'Impossible de lister les buckets' });
  }
});

router.get('/clients', async (req, res) => {
  try {
    const clients = await deployment.listClients(bucketName);
    res.json({ clients });
  } catch (err) {
    console.error('Erreur listage clients :', err);
    res.status(500).json({ error: 'Impossible de lister les clients' });
  }
});

router.get('/clients/:clientId/services', async (req, res) => {
  const { clientId } = req.params;
  try {
    const services = await deployment.listServices(bucketName, clientId);
    res.json({ clientId, services });
  } catch (err) {
    console.error(`Erreur listage services pour ${clientId} :`, err);
    res.status(500).json({ error: 'Impossible de lister les services' });
  }
});

// SSE endpoint for streaming real-time plan output
router.get('/:clientId/:serviceId/plan/stream', (req, res) => {
  const { clientId, serviceId } = req.params;
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  registerClient(clientId, serviceId, res);
  req.on('close', () => removeClient(clientId, serviceId, res));
});

// Start a plan loop for a client/service
router.post('/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;
  try {
    await deployment.executePlan(clientId, serviceId, bucketName);
    res.json({ status: 'plan loop started' });
  } catch (err) {
    console.error(`Erreur démarrage plan pour ${clientId}/${serviceId} :`, err);
    res.status(500).json({ error: 'Impossible de démarrer le plan' });
  }
});

// Stop a plan loop for a client/service
router.delete('/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;
  try {
    deployment.stopPlan(clientId, serviceId);
    res.json({ status: 'plan loop stopped' });
  } catch (err) {
    console.error(`Erreur arrêt plan pour ${clientId}/${serviceId} :`, err);
    res.status(500).json({ error: 'Impossible d\'arrêter le plan' });
  }
});


// Execute pre-defined actions to create or destroy network for a client
router.post('/:clientId/network/:action', async (req, res) => {
  const { clientId, serviceId, action } = req.params;
  const validActions = ['apply', 'destroy'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Action invalide' });
  }

  try {
    await deployment.executeAction(action, clientId, "network", bucketName, res, './opentofu/network');
  } catch (err) {
    console.error(`Erreur exécution ${action} pour ${clientId}/"network" :`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Erreur lors de l'exécution de l'action ${action}` });
    }
  }
});

// Execute an action (apply or destroy)
router.post('/:clientId/:serviceId/:action', async (req, res) => {
  const { clientId, serviceId, action } = req.params;
  const validActions = ['apply', 'destroy'];
  
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Action invalide' });
  }
  
  try {
    await deployment.executeAction(action, clientId, serviceId, bucketName, res);
  } catch (err) {
    console.error(`Erreur exécution ${action} pour ${clientId}/${serviceId} :`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Erreur lors de l'exécution de l'action ${action}` });
    }
  }
});

// Cancel a running job
router.delete('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    deployment.cancelJob(jobId);
    res.json({ status: 'job cancelled' });
  } catch (err) {
    console.error(`Erreur annulation job ${jobId} :`, err);
    res.status(500).json({ error: 'Impossible d\'annuler le job' });
  }
});

router.post('/clients/:clientId/:serviceId/config', async (req, res) => {
  const { clientId, serviceId } = req.params;
  const config = req.body;
  try {
    const key = `clients/${clientId}/${serviceId}/terraform.tfvars.json`;
    await deployment.createFile(bucketName, key, JSON.stringify(config, null, 2));
    res.json({ status: 'uploaded', key });
  } catch (err) {
    console.error('Erreur upload config :', err);
    res.status(500).json({ error: 'Échec de l\'upload de la configuration' });
  }
});


module.exports = router;