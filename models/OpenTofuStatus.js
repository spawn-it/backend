class OpenTofuStatus {
  /**
   * @param {string} key - unique key for the execution context (e.g. client/service)
   * @param {string} lastAction - last action performed (e.g. 'apply', 'destroy')
   * @param {string} output - full tofu output
   * @param {Date} timestamp - when the status was generated
   * @param {Error|null} error - optional error
   * @param {boolean} applied - whether infrastructure is applied/up-to-date
   */
  constructor(key, lastAction, output, timestamp = new Date(), error = null, applied = false) {
    this.key = key;
    this.lastAction = lastAction;
    this.output = output;
    this.timestamp = timestamp;
    this.error = error;
    this.applied = applied;
  }

  /**
   * Convertit l'instance en objet JSON sérialisable
   * @returns {Object}
   */
  toJSON() {
    return {
      key: this.key,
      lastAction: this.lastAction,
      output: this.output,
      timestamp: this.timestamp.toISOString(),
      errorMessage: this.error ? this.error.message : null,
      errorStack: this.error ? this.error.stack : null,
      applied: this.applied
    };
  }

  /**
   * Crée une instance depuis la sortie d'un plan
   * @param {string} key 
   * @param {string} output 
   * @param {string} lastAction - dernière action effectuée
   * @returns {OpenTofuStatus}
   */
  static fromPlanOutput(key, output, lastAction = 'plan') {
    let applied = false;
    
    if (/No changes\. (?:Infrastructure is up-to-date\.|Your infrastructure matches the configuration\.)/i.test(output)) {
      applied = true;
    } else if (/Plan: \d+ to add, \d+ to change, \d+ to destroy\./i.test(output)) {
      applied = false;
    } else if (/No changes\./i.test(output)) {
      applied = true;
    }
    return new OpenTofuStatus(key, lastAction, output, new Date(), null, applied);
  }

  /**
   * Crée une instance pour une erreur
   * @param {string} key 
   * @param {string} output 
   * @param {Error} error 
   * @param {string} lastAction - dernière action avant l'erreur
   * @returns {OpenTofuStatus}
   */
  static fromError(key, output, error, lastAction = 'unknown') {
    return new OpenTofuStatus(key, lastAction, output, new Date(), error, false);
  }
}

module.exports = OpenTofuStatus;