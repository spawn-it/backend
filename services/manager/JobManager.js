/**
 * Job Manager for OpenTofu process management
 * Handles creation, tracking, and cancellation of OpenTofu jobs
 */
const { v4: uuidv4 } = require('uuid');

class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Creates a new job with a unique UUID
   * @returns {string} Generated job ID
   */
  createJob() {
    const jobId = uuidv4();
    return jobId;
  }

  /**
   * Associates a process with a job ID
   * @param {string} jobId - Job identifier
   * @param {ChildProcess} process - Process to associate with the job
   * @returns {void}
   */
  setJob(jobId, process) {
    this.jobs.set(jobId, process);
  }

  /**
   * Retrieves a job process by ID
   * @param {string} jobId - Job identifier
   * @returns {ChildProcess|undefined} Process associated with the job
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Removes a job from tracking
   * @param {string} jobId - Job identifier
   * @returns {boolean} True if job was removed
   */
  removeJob(jobId) {
    return this.jobs.delete(jobId);
  }

  /**
   * Cancels a running OpenTofu job
   * @param {string} jobId - Job identifier to cancel
   * @returns {boolean} True if job was cancelled, false if not found
   */
  cancelJob(jobId) {
    const proc = this.jobs.get(jobId);
    if (!proc) {
      return false;
    }

    proc.kill('SIGTERM');
    this.jobs.delete(jobId);
    console.log(`[JobManager] Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Gets all active job IDs
   * @returns {string[]} Array of active job identifiers
   */
  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }
}

module.exports = new JobManager();