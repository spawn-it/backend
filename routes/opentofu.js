/**
 * API Routes for OpenTofu service management
 * Handles all HTTP endpoints for client and service operations
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Services
const tofuService = require('../services/OpentofuService');
const { registerClient, removeClient } = require('../sse/clients');

// Config and Utils
const { Action, DefaultValues } = require('../config/constants');
const PathHelper = require('../utils/pathHelper');

// Environment variables
const bucketName = process.env.S3_BUCKET;

/**
 * Lists all services for a specific client
 * GET /clients/:clientId/services
 */
router.get('/clients/:clientId/services', async (req, res) => {
  const { clientId } = req.params;
  try {
    const services = await tofuService.listServices(bucketName, clientId);
    res.json({ clientId, services });
  } catch (err) {
    console.error(`Error listing services for ${clientId}:`, err);
    res.status(500).json({ error: 'Unable to list services' });
  }
});

/**
 * Completely deletes a service (destroy + file cleanup)
 * DELETE /clients/:clientId/:serviceId
 */
router.delete('/clients/:clientId/:serviceId', async (req, res) => {
  const { clientId, serviceId } = req.params;

  try {
    // Stop any running plan loops
    tofuService.stopPlan(clientId, serviceId);

    // Execute destroy action
    try {
      await tofuService.executeAction(Action.DESTROY, clientId, serviceId, bucketName, null);
    } catch (e) {
      console.warn(`Destroy failed for ${clientId}/${serviceId}:`, e.message);
    }

    const prefix = PathHelper.getServicePrefix(clientId, serviceId);
    await Promise.all([
      tofuService.deleteServiceFiles(bucketName, prefix),
      tofuService.cleanupService(clientId, serviceId)
    ]);

    res.json({ status: 'deleted', message: `Service ${serviceId} completely deleted` });
  } catch (err) {
    console.error(`Error deleting service ${clientId}/${serviceId}:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'Error deleting service' });
  }
});

/**
 * SSE endpoint for real-time plan output streaming
 * GET /clients/:clientId/:serviceId/plan/stream
 */
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

/**
 * Checks if network configuration exists for a provider
 * GET /clients/:clientId/network/config?provider=<provider>
 */
router.get('/clients/:clientId/network/config', async (req, res) => {
  const { clientId } = req.params;
  const { provider } = req.query;

  if (!provider) {
    return res.status(400).json({ error: 'Provider missing in request' });
  }

  const key = PathHelper.getNetworkConfigKey(clientId, provider);

  try {
    await tofuService.checkNetworkConfigExists(bucketName, key);
    res.json({ exists: true, key });
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      res.status(404).json({ exists: false, key });
    } else {
      console.error(`Error checking network config for ${clientId}:`, err);
      res.status(500).json({ error: 'Error checking network configuration' });
    }
  }
});

/**
 * Uploads network configuration for Terraform
 * POST /clients/:clientId/network/config
 */
router.post('/clients/:clientId/network/config', async (req, res) => {
  const { clientId } = req.params;
  const config = req.body;

  // Validation
  const validationError = validateNetworkConfig(config);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  try {
    const key = PathHelper.getNetworkConfigKey(clientId, config.provider);

    const networkConfig = {
      instance: {
        provider: config.provider,
        network_name: config.network_name,
        region: config.region || DefaultValues.REGION,
        environment: config.environment || DefaultValues.ENVIRONMENT
      }
    };

    await tofuService.createFile(bucketName, key, JSON.stringify(networkConfig, null, 2));

    res.json({
      status: 'uploaded',
      key,
      config: networkConfig
    });
  } catch (err) {
    console.error('Error uploading network config:', err);
    res.status(500).json({
      error: "Failed to upload network configuration",
      details: err.message
    });
  }
});

/**
 * Checks network compliance status
 * GET /clients/:clientId/network/status?provider=<provider>
 */
router.get('/clients/:clientId/network/status', async (req, res) => {
  const { clientId } = req.params;
  const provider = req.query.provider || 'local';
  const key = PathHelper.getNetworkConfigKey(clientId, provider);

  try {
    const status = await tofuService.checkNetworkStatus(clientId, bucketName, key);
    res.json(status);
  } catch (err) {
    console.error(`Error checking network status for ${clientId}:`, err);
    res.status(500).json({ error: 'Unable to check network status' });
  }
});

/**
 * Applies or destroys network infrastructure
 * POST /clients/:clientId/network/:action
 */
router.post('/clients/:clientId/network/:action', async (req, res) => {
  const { clientId, action } = req.params;
  const { provider } = req.body;

  if (!isValidAction(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (!provider) {
    return res.status(400).json({ error: "Provider missing for network action" });
  }

  const servicePath = PathHelper.getNetworkServiceId(provider);
  const sourcePath = `./opentofu/networks/${provider}`;

  try {
    await tofuService.executeAction(action, clientId, servicePath, bucketName, res, sourcePath);
  } catch (err) {
    console.error(`Error executing ${action} for ${clientId}/${servicePath}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Error executing action ${action}` });
    }
  }
});

/**
 * Starts a plan loop for a service
 * POST /clients/:clientId/:serviceId/plan
 */
router.post('/clients/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;

  try {
    await tofuService.executePlan(clientId, serviceId, bucketName);
    res.json({ status: 'plan loop started' });
  } catch (err) {
    console.error(`Error starting plan for ${clientId}/${serviceId}:`, err);
    res.status(500).json({ error: 'Unable to start plan' });
  }
});

/**
 * Uploads service configuration
 * POST /clients/:clientId/:serviceType/config
 */
router.post('/clients/:clientId/:serviceType/config', async (req, res) => {
  const { clientId, serviceType } = req.params;
  const serviceId = uuidv4();
  const config = req.body;
  config['network_name'] = `network-${clientId}`;

  try {
    const serviceInformation = {
      serviceName: config.container_name,
      serviceType: serviceType,
      autoApply: false,
      status: {},
    };

    // Maintenant on écrase container_name pour terraform
    config['container_name'] = uuidv4();
    const serviceInfoKey = PathHelper.getServiceInfoKey(clientId, serviceId);
    await tofuService.createFile(bucketName, serviceInfoKey, JSON.stringify(serviceInformation, null, 2));
    const configKey = PathHelper.getServiceConfigKey(clientId, serviceId);
    const serviceConfig = { instance: config };
    await tofuService.createFile(bucketName, configKey, JSON.stringify(serviceConfig, null, 2));
    res.json({ status: 'uploaded', serviceId });
  } catch (err) {
    console.error('Error uploading config:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: "Failed to upload configuration", details: err.message });
  }
});

/**
 * Stops a plan loop for a service
 * DELETE /clients/:clientId/:serviceId/plan
 */
router.delete('/clients/:clientId/:serviceId/plan', async (req, res) => {
  const { clientId, serviceId } = req.params;

  try {
    tofuService.stopPlan(clientId, serviceId);
    res.json({ status: 'plan loop stopped' });
  } catch (err) {
    console.error(`Error stopping plan for ${clientId}/${serviceId}:`, err);
    res.status(500).json({ error: "Unable to stop plan" });
  }
});

/**
 * Applies or destroys a service
 * POST /clients/:clientId/:serviceId/:action
 */
router.post('/clients/:clientId/:serviceId/:action', async (req, res) => {
  const { clientId, serviceId, action } = req.params;

  if (!isValidAction(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    await tofuService.executeAction(action, clientId, serviceId, bucketName, res);
  } catch (err) {
    console.error(`Error executing ${action} for ${clientId}/${serviceId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: `Error executing action ${action}` });
    }
  }
});

/**
 * Cancels a running job
 * DELETE /jobs/:jobId
 */
router.delete('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    tofuService.cancelJob(jobId);
    res.json({ status: 'job cancelled' });
  } catch (err) {
    console.error(`Error cancelling job ${jobId}:`, err);
    res.status(500).json({ error: "Unable to cancel job" });
  }
});

// Helper functions

/**
 * Validates network configuration request body
 * @param {Object} config - Network configuration object
 * @returns {Object|null} Validation error object or null if valid
 */
function validateNetworkConfig(config) {
  if (!config) {
    return {
      error: 'No configuration provided',
      received: config
    };
  }

  if (!config.provider) {
    return {
      error: 'Provider missing in configuration',
      received: config
    };
  }

  if (!config.network_name) {
    return {
      error: 'network_name missing in configuration',
      received: config
    };
  }

  return null;
}

/**
 * Checks if action is valid
 * @param {string} action - Action to validate
 * @returns {boolean} True if action is valid
 */
function isValidAction(action) {
  return Object.values(Action).includes(action);
}

module.exports = router;