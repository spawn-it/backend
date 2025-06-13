/**
 * Application constants and configuration values
 */
const Action = Object.freeze({
  APPLY: 'apply',
  DESTROY: 'destroy',
  PLAN: 'plan',
});

/**
 * Service types for categorizing execution contexts
 * @type {Readonly<{NETWORK: string, SERVICE: string}>}
 */
const ServiceType = Object.freeze({
  NETWORK: 'network',
  SERVICE: 'service',
});

/**
 * Prefixes and filenames for S3 storage
 * @type {Readonly<{BASE_PREFIX: string, NETWORK_PREFIX: string, INFO_FILE: string, TFVARS_FILE: string}>}
 */
const S3Config = Object.freeze({
  BASE_PREFIX: 'clients/',
  NETWORK_PREFIX: 'network/',
  INFO_FILE: 'info.json',
  TFVARS_FILE: 'terraform.tfvars.json',
});

/**
 * Default configuration values for the application
 * @type {Readonly<{REGION: string, ENVIRONMENT: string, PLAN_INTERVAL_MS: number, S3_REGION: string}>}
 */
const DefaultValues = Object.freeze({
  REGION: 'us-east-1',
  ENVIRONMENT: 'dev',
  PLAN_INTERVAL_MS: 10000,
  S3_REGION: 'eu-central-1',
});

/**
 * Checks if a service ID belongs to a network service
 * @param serviceId {string} - The service ID to check
 * @returns {boolean} - True if the service ID starts with the network prefix, false otherwise
 */
function isNetworkService(serviceId) {
  return serviceId.startsWith(S3Config.NETWORK_PREFIX);
}

module.exports = {
  Action,
  ServiceType,
  S3Config,
  DefaultValues,
  isNetworkService,
};
