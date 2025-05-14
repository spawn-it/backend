const express = require('express');
const router = express.Router();
const { handleOpenTofuAction, startPlanLoop } = require('../services/opentofu');
const { downloadOpenTofuFilesFromS3 } = require('../services/s3');
const { registerClient, removeClient, sendToClients } = require('../sse/clients');

const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const bucketName = process.env.BUCKET_NAME;

router.get('/:clientId/:serviceId/plan/stream', (req, res) => {
    const { clientId, serviceId } = req.params;
    registerClient(clientId, serviceId, res);

    req.on('close', () => {
        removeClient(clientId, serviceId, res);
    });
});

router.post('/:clientId/:serviceId/:action', async (req, res) => {
    const { clientId, serviceId, action } = req.params;
    const validActions = ['plan', 'apply', 'destroy'];

    if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    const prefix = `${clientId}/${serviceId}/`;
    const workingDir = path.join(os.tmpdir(), `tf-${clientId}-${serviceId}`);
    await fs.mkdir(workingDir, { recursive: true });

    await downloadOpenTofuFilesFromS3(bucketName, prefix, workingDir);

    if (action === 'plan') {
        startPlanLoop(clientId, serviceId, workingDir);
        res.json({ status: 'plan loop started' });
    } else {
        await handleOpenTofuAction(action, clientId, serviceId, workingDir, res);
    }
});


module.exports = router;
