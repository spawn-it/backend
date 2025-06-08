/**
 * Application constants and configuration values
 */
const Action = Object.freeze({
    APPLY: 'apply',
    DESTROY: 'destroy',
    PLAN: 'plan'
});

const ServiceType = Object.freeze({
    NETWORK: 'network',
    SERVICE: 'service'
});

const S3Config = Object.freeze({
    BASE_PREFIX: 'clients/',
    NETWORK_PREFIX: 'network/',
    INFO_FILE: 'info.json',
    TFVARS_FILE: 'terraform.tfvars.json'
});

const DefaultValues = Object.freeze({
    REGION: 'us-east-1',
    ENVIRONMENT: 'dev',
    PLAN_INTERVAL_MS: 10000,
    S3_REGION: 'eu-central-1'
});

function getActionName(action) {
    if (action === Action.APPLY) return 'Apply';
    if (action === Action.DESTROY) return 'Destroy';
    if (action === Action.PLAN) return 'Plan';
    throw new Error(`Unknown action: ${action}`);
}

function isNetworkService(serviceId) {
    return serviceId.startsWith(S3Config.NETWORK_PREFIX);
}

module.exports = {
    Action,
    ServiceType,
    S3Config,
    DefaultValues,
    getActionName,
    isNetworkService
};