class OpenTofuStatus {
    /**
     * @param {string} key - unique key for the execution context (e.g. client/service)
     * @param {string} state - 'compliant', 'drifted', 'error', 'unknown', etc.
     * @param {string} output - full tofu output
     * @param {Date} timestamp - when the status was generated
     * @param {Error|null} error - optional error
     */
    constructor(key, state, output, timestamp = new Date(), error = null) {
      this.key = key;
      this.state = state;
      this.output = output;
      this.timestamp = timestamp;
      this.error = error;
    }
  
    isCompliant() {
      return this.state === 'compliant';
    }
  
    isDrifted() {
      return this.state === 'drifted';
    }
  
    isError() {
      return this.state === 'error';
    }
  
    /**
     * Convertit l'instance en objet JSON sérialisable
     * @returns {Object}
     */
    toJSON() {
      return {
        key: this.key,
        state: this.state,
        compliant: this.isCompliant(),
        drifted: this.isDrifted(),
        error: this.isError(),
        output: this.output,
        timestamp: this.timestamp.toISOString(),
        errorMessage: this.error ? this.error.message : null,
        errorStack: this.error ? this.error.stack : null
      };
    }
  
    static fromPlanOutput(key, output) {
      let state = 'unknown';
      
      if (/No changes\. (?:Infrastructure is up-to-date\.|Your infrastructure matches the configuration\.)/i.test(output)) {
        state = 'compliant';
      } else if (/Plan: \d+ to add, \d+ to change, \d+ to destroy\./i.test(output)) {
        state = 'drifted';
      } else if (/No changes\./i.test(output)) {
        // Catch-all pour toute variation de "No changes"
        state = 'compliant';
      }
      
      console.log(`[DEBUG] OpenTofuStatus.fromPlanOutput: détecté state="${state}" pour output:`, output.substring(0, 200));
      
      return new OpenTofuStatus(key, state, output);
    }
  
    static fromError(key, output, error) {
      return new OpenTofuStatus(key, 'error', output, new Date(), error);
    }
  }
  
  module.exports = OpenTofuStatus;