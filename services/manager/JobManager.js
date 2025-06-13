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
   * Removes a job from tracking
   * @param {string} jobId - Job identifier
   * @returns {boolean} True if job was removed
   */
  removeJob(jobId) {
    return this.jobs.delete(jobId);
  }
}

module.exports = new JobManager();
