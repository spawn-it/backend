const express = require('express');
const router = express.Router();
const deployment = require('../services/OpentofuService');
const { registerClient, removeClient } = require('../sse/clients');
const { v4: uuidv4 } = require('uuid');
const bucketName = process.env.S3_BUCKET;


// Liste les services d'un client
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

router.delete('/clients/:clientId/:serviceId', async (req, res) => {
  const { clientId, serviceId } = req.params;
  console.log(`[DEBUG] Route delete service complet: ${clientId}/${serviceId}`);

  try {
    deployment.stopPlan(clientId, serviceId);
    try {
      const fakeRes = {
        json: () => {}, 
        headersSent: false,
        status: () => ({ json: () => {} })
      };
      
      console.log(`[DELETE] Début du destroy pour ${clientId}/${serviceId}`);
      await deployment.executeAction('destroy', clientId, serviceId, bucketName, fakeRes);
      
      // Attendre que le destroy se termine
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`[DELETE] Destroy terminé pour ${clientId}/${serviceId}`);
      
    } catch (destroyErr) {
      console.warn(`[DELETE] Erreur lors du destroy de ${clientId}/${serviceId}:`, destroyErr.message);
      // Continuer même si le destroy échoue (infrastructure peut déjà être détruite)
    }

    console.log(`[DELETE] Suppression des fichiers S3 pour ${clientId}/${serviceId}`);
    const servicePrefix = `clients/${clientId}/${serviceId}/`;
    await deployment.deleteServiceFiles(bucketName, servicePrefix);

    console.log(`[DELETE] Service ${clientId}/${serviceId} supprimé complètement`);
    res.json({
      status: 'deleted',
      message: `Service ${serviceId} supprimé complètement`
    });

  } catch (err) {
    console.error(`Erreur suppression complète de ${clientId}/${serviceId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors de la suppression du service' });
    }
  }
});

// SSE pour la sortie en direct de plan
router.get('/clients/:clientId/:serviceId/plan/stream', (req, res) => {
  const { clientId, serviceId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  registerClient(clientId, serviceId, res);
  req.on('close', () => removeClient(clientId, serviceId, res));
});

// Vérifie si la config réseau existe (avec provider dynamique)
router.get('/clients/:clientId/network/config', async (req, res) => {
  const { clientId } = req.params;
  const { provider } = req.query;

  if (!provider) {
    return res.status(400).json({ error: 'Provider manquant dans la requête' });
  }

  const key = `clients/${clientId}/network/${provider}/terraform.tfvars.json`;

  try {
    await deployment.checkNetworkConfigExists(bucketName, key);
    res.json({ exists: true, key });
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      res.status(404).json({ exists: false, key });
    } else {
      console.error(`[TOFU] Erreur vérification config réseau ${clientId}:`, err);
      res.status(500).json({ error: 'Erreur lors de la vérification de la configuration réseau' });
    }
  }
});

// Upload de configuration réseau Terraform
router.post('/clients/:clientId/network/config', async (req, res) => {
  const { clientId } = req.params;
  const config = req.body;
  console.log(`[DEBUG ROUTE CONFIG] Received for ${clientId}/${serviceId}:`, JSON.stringify(configFromFrontend, null, 2));

  // Validation améliorée avec logs
  if (!config) {
    console.log('[TOFU] Erreur: Aucune configuration fournie');
    return res.status(400).json({ 
      error: 'Aucune configuration fournie',
      received: config 
    });
  }

  if (!config.provider) {
    console.log('[TOFU] Erreur: Provider manquant, config reçue:', config);
    return res.status(400).json({ 
      error: 'Provider manquant dans la configuration',
      received: config 
    });
  }

  if (!config.network_name) {
    console.log('[TOFU] Erreur: network_name manquant, config reçue:', config);
    return res.status(400).json({ 
      error: 'network_name manquant dans la configuration',
      received: config 
    });
  }

  try {
    const key = `clients/${clientId}/network/${config.provider}/terraform.tfvars.json`;
    

    const networkConfig = {
      instance: {
        provider: config.provider,
        network_name: config.network_name,
        region: config.region || 'us-east-1',
        environment: config.environment || 'dev'
      }
    };

    console.log(`[TOFU] Création du fichier S3: ${key}`);
    console.log('[TOFU] Contenu final:', JSON.stringify(networkConfig, null, 2));

    await deployment.createFile(bucketName, key, JSON.stringify(networkConfig, null, 2));
    
    console.log(`[TOFU] Config réseau créée avec succès: ${key}`);
    res.json({ 
      status: 'uploaded', 
      key,
      config: networkConfig 
    });
  } catch (err) {
    console.error('[TOFU] Erreur upload config réseau:', err);
    res.status(500).json({ error: "Échec de l'upload de la configuration réseau", details: err.message });
  }
});

// Vérifie si le réseau est compliant
router.get('/clients/:clientId/network/status', async (req, res) => {
  const { clientId } = req.params;
  const provider = req.query.provider || 'local';
  const key = `clients/${clientId}/network/${provider}/terraform.tfvars.json`;

  try {
    const status = await deployment.checkNetworkStatus(clientId, bucketName, key);
    res.json(status);
  } catch (err) {
    console.error(`[TOFU] Erreur statut réseau ${clientId}:`, err);
    res.status(500).json({ error: 'Impossible de vérifier le statut réseau' });
  }
});

// Appliquer ou détruire l'infrastructure réseau - ROUTE SPÉCIFIQUE AVANT LES GÉNÉRIQUES
router.post('/clients/:clientId/network/:action', async (req, res) => {
  const { clientId, action } = req.params;
  const { provider } = req.body;
  const validActions = ['apply', 'destroy'];

  console.log(`[DEBUG] Route réseau action: ${clientId}/network/${action}`);

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Action invalide' });
  }

  if (!provider) {
    return res.status(400).json({ error: "Provider manquant pour l'action réseau" });
  }

  const servicePath = `network/${provider}`;
  const sourcePath = `./opentofu/networks/${provider}`;

  try {
    await deployment.executeAction(action, clientId, servicePath, bucketName, res, sourcePath);
  } catch (err) {
    console.error(`Erreur exécution ${action} pour ${clientId}/${servicePath} :`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Erreur lors de l'exécution de l'action ${action}` });
    }
  }
});

// Démarrer une boucle de plan - ROUTE SPÉCIFIQUE
router.post('/clients/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;
  console.log(`[DEBUG] Route plan: ${clientId}/${serviceId}/plan`);
  
  try {
    await deployment.executePlan(clientId, serviceId, bucketName);
    res.json({ status: 'plan loop started' });
  } catch (err) {
    console.error(`Erreur démarrage plan pour ${clientId}/${serviceId} :`, err);
    res.status(500).json({ error: 'Impossible de démarrer le plan' });
  }
});

// Upload de configuration terraform pour services - ROUTE SPÉCIFIQUE
router.post('/clients/:clientId/:serviceType/config', async (req, res) => {
  const { clientId, serviceType } = req.params;
  const serviceId = uuidv4();

  const config = req.body;
  
  console.log(`[DEBUG] Route service config: ${clientId}/${serviceId}/config`);
  
  config['network_name'] = `network-${clientId}`;

  try {

    const serviceInfomation = {
      serviceName: config.container_name,
      serviceType : serviceType,
      autoApply: false,
      status: {},
    }

    config['container_name'] = uuidv4();

    const serviceKey = `clients/${clientId}/${serviceId}/info.json`;
    await deployment.createFile(bucketName, serviceKey, JSON.stringify(serviceInfomation, null, 2));

    const key = `clients/${clientId}/${serviceId}/terraform.tfvars.json`;
    
    const serviceConfig = {
      instance: config
    };
    await deployment.createFile(bucketName, key, JSON.stringify(serviceConfig, null, 2));
    
    res.json({ status: 'uploaded', serviceId });
  } catch (err) {
    console.error('Erreur upload config :', err);
    res.status(500).json({ error: "Échec de l'upload de la configuration" });
  }
});

// Arrêter une boucle de plan - ROUTE SPÉCIFIQUE
router.delete('/clients/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;
  console.log(`[DEBUG] Route delete plan: ${clientId}/${serviceId}/plan`);
  
  try {
    deployment.stopPlan(clientId, serviceId);
    res.json({ status: 'plan loop stopped' });
  } catch (err) {
    console.error(`Erreur arrêt plan pour ${clientId}/${serviceId} :`, err);
    res.status(500).json({ error: "Impossible d'arrêter le plan" });
  }
});

// Appliquer ou détruire un service
router.post('/clients/:clientId/:serviceId/:action', async (req, res) => {
  const { clientId, serviceId, action } = req.params;
  const validActions = ['apply', 'destroy'];

  console.log(`[DEBUG] Route générique service: ${clientId}/${serviceId}/${action}`);

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

// Annuler un job en cours
router.delete('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    deployment.cancelJob(jobId);
    res.json({ status: 'job cancelled' });
  } catch (err) {
    console.error(`Erreur annulation job ${jobId} :`, err);
    res.status(500).json({ error: "Impossible d'annuler le job" });
  }
});

module.exports = router;
