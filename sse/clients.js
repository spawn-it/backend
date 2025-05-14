const sseClients = new Map(); // key = clientId/serviceId → [res, res...]

function getKey(clientId, serviceId) {
    return `${clientId}/${serviceId}`;
}

function registerClient(clientId, serviceId, res) {
    const key = getKey(clientId, serviceId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!sseClients.has(key)) sseClients.set(key, []);
    sseClients.get(key).push(res);
}

function removeClient(clientId, serviceId, res) {
    const key = getKey(clientId, serviceId);
    const list = sseClients.get(key)?.filter(r => r !== res) || [];
    if (list.length === 0) {
        sseClients.delete(key);
    } else {
        sseClients.set(key, list);
    }
}

function sendToClients(clientId, serviceId, message, event = 'message') {
    const key = getKey(clientId, serviceId);
    const list = sseClients.get(key) || [];
    for (const res of list) {
        res.write(`event: ${event}\ndata: ${message}\n\n`);
    }
}

module.exports = { registerClient, removeClient, sendToClients };
