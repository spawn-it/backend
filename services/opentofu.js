const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { sendToClients } = require('../sse/clients');

const jobs = new Map();
const planLoops = new Map();

function getJobKey(clientId, serviceId) {
    return `${clientId}/${serviceId}`;
}

function stopPlanLoop(clientId, serviceId) {
    const key = getJobKey(clientId, serviceId);
    const id = planLoops.get(key);
    if (id) {
        clearInterval(id);
        planLoops.delete(key);
        console.log(`[PLAN] stopped for ${key}`);
    }
}

function startPlanLoop(clientId, serviceId, workingDir) {
    const key = getJobKey(clientId, serviceId);
    if (planLoops.has(key)) return;

    const intervalId = setInterval(() => {
        const proc = spawn('terraform', ['plan', '-no-color'], { cwd: workingDir });
        let output = '';

        proc.stdout.on('data', (data) => output += data.toString());
        proc.on('close', () => {
            sendToClients(clientId, serviceId, output);
        });
    }, 10000);

    planLoops.set(key, intervalId);
    console.log(`[PLAN] started for ${key}`);
}

async function handleOpenTofuAction(command, clientId, serviceId, workingDir, res) {
    const key = getJobKey(clientId, serviceId);
    stopPlanLoop(clientId, serviceId);

    const args = [command];
    if (command === 'apply' || command === 'destroy') args.push('-auto-approve');

    const proc = spawn('terraform', args, { cwd: workingDir });
    const jobId = uuidv4();
    jobs.set(jobId, proc);

    res.json({ jobId });

    let output = '';
    proc.stdout.on('data', (data) => output += data.toString());
    proc.stderr.on('data', (data) => output += data.toString());

    proc.on('close', (code) => {
        if (command === 'apply') {
            startPlanLoop(clientId, serviceId, workingDir);
        }
        jobs.delete(jobId);
        sendToClients(clientId, serviceId, `${command} terminé avec code ${code}`, 'end');
    });
}

module.exports = {
    handleOpenTofuAction,
    startPlanLoop,
    stopPlanLoop,
};
