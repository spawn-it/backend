/**
 * Startup Service - Initializes plan loops for all existing services
 * Automatically starts monitoring all services when the application starts
 */
const tofuService = require('./OpentofuService');
const workingDirectoryService = require('./WorkingDirectoryService');
const planLoopManager = require('./manager/PlanLoopManager');

class StartupService {
  /**
   * Initializes plan loops for all existing services across all clients
   * @param {string} bucketName - S3 bucket name
   * @returns {Promise<Object>} Summary of started loops
   */
  static async initializeAllPlanLoops(bucketName) {
    console.log(
      '[StartupService] Starting plan loops for all existing services...'
    );

    const summary = {
      clientsProcessed: 0,
      servicesStarted: 0,
      errors: [],
    };

    try {
      // Get all clients
      const clients = await tofuService.listClients(bucketName);
      console.log(`[StartupService] Found ${clients.length} clients`);

      for (const clientId of clients) {
        try {
          summary.clientsProcessed++;

          // Get all services for this client
          const services = await tofuService.listServices(bucketName, clientId);
          const serviceIds = Object.keys(services);

          console.log(
            `[StartupService] Client ${clientId}: ${serviceIds.length} services found`
          );

          for (const serviceId of serviceIds) {
            try {
              // Skip services that have errors in their info
              if (services[serviceId]?.error) {
                console.warn(
                  `[StartupService] Skipping service ${clientId}/${serviceId}: has errors`
                );
                continue;
              }

              // Prepare working directory and start plan loop
              const dataDir = await workingDirectoryService.prepare(
                clientId,
                serviceId,
                bucketName
              );
              planLoopManager.start(clientId, serviceId, dataDir);

              summary.servicesStarted++;
              console.log(
                `[StartupService] Started plan loop for ${clientId}/${serviceId}`
              );
            } catch (serviceErr) {
              const errorMsg = `Failed to start plan loop for ${clientId}/${serviceId}: ${serviceErr.message}`;
              console.error(`[StartupService] ${errorMsg}`);
              summary.errors.push(errorMsg);
            }
          }
        } catch (clientErr) {
          const errorMsg = `Failed to process client ${clientId}: ${clientErr.message}`;
          console.error(`[StartupService] ${errorMsg}`);
          summary.errors.push(errorMsg);
        }
      }

      console.log(`[StartupService] Initialization complete:`);
      console.log(`  - Clients processed: ${summary.clientsProcessed}`);
      console.log(`  - Services started: ${summary.servicesStarted}`);
      console.log(`  - Errors: ${summary.errors.length}`);

      if (summary.errors.length > 0) {
        console.log(`[StartupService] Errors encountered:`);
        summary.errors.forEach((error) => console.log(`  - ${error}`));
      }

      return summary;
    } catch (err) {
      console.error('[StartupService] Failed to initialize plan loops:', err);
      throw err;
    }
  }

  /**
   * Gracefully stops all plan loops during application shutdown
   * @returns {void}
   */
  static stopAllPlanLoops() {
    console.log('[StartupService] Stopping all plan loops...');

    const activeLoops = planLoopManager.getActiveLoops();
    console.log(
      `[StartupService] Stopping ${activeLoops.length} active plan loops`
    );

    for (const loopKey of activeLoops) {
      const [clientId, serviceId] = loopKey.split('/');
      planLoopManager.stop(clientId, serviceId);
    }

    console.log('[StartupService] All plan loops stopped');
  }
}

module.exports = StartupService;
