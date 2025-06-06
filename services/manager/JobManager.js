const { v4: uuidv4 } = require('uuid');

class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Créer un nouveau job avec un UUID
   */
  createJob() {
    const jobId = uuidv4();
    return jobId;
  }

  /**
   * Ajouter un processus à un job
   */
  setJob(jobId, process) {
    this.jobs.set(jobId, process);
  }

  /**
   * Récupérer un job
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Supprimer un job
   */
  removeJob(jobId) {
    this.jobs.delete(jobId);
  }

  /**
   * Annuler un job terraform
   */
  cancelJob(jobId) {
    const proc = this.jobs.get(jobId);
    if (!proc) return false;
    
    proc.kill('SIGTERM');
    this.jobs.delete(jobId);
    console.log(`[TOFU] job cancelled ${jobId}`);
    return true;
  }

  /**
   * Obtenir tous les jobs actifs
   */
  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }
}

module.exports = new JobManager();