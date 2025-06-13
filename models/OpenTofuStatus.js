/**
 * OpenTofu Status Model
 * Represents the status and output of OpenTofu operations
 * Tracks execution state, results, and infrastructure status
 */
class OpenTofuStatus {
  /**
   * Creates a new OpenTofu status instance
   * @param {string} key - Unique key for the execution context (e.g. client/service)
   * @param {string} lastAction - Last action performed (e.g. 'apply', 'destroy', 'plan')
   * @param {string} output - Full OpenTofu command output
   * @param {Date} timestamp - When the status was generated
   * @param {Error|null} error - Optional error object
   * @param {boolean} applied - Whether infrastructure is applied/up-to-date
   */
  constructor(
    key,
    lastAction,
    output,
    timestamp = new Date(),
    error = null,
    applied = false
  ) {
    this.key = key;
    this.lastAction = lastAction;
    this.output = output;
    this.timestamp = timestamp;
    this.error = error;
    this.applied = applied;
  }

  /**
   * Converts the instance to a JSON serializable object
   * @returns {Object} JSON representation of the status
   */
  toJSON() {
    return {
      key: this.key,
      lastAction: this.lastAction,
      output: this.output,
      timestamp: this.timestamp.toISOString(),
      errorMessage: this.error ? this.error.message : null,
      errorStack: this.error ? this.error.stack : null,
      applied: this.applied,
    };
  }

  /**
   * Creates an instance from plan command output
   * Analyzes the output to determine if infrastructure is up-to-date
   * @param {string} key - Execution context key
   * @param {string} output - Plan command output
   * @param {string} lastAction - Last action performed (defaults to 'plan')
   * @returns {OpenTofuStatus} Status instance based on plan output
   */
  static fromPlanOutput(key, output, lastAction = 'plan') {
    let applied = false;

    // Check for various "no changes" patterns
    if (
      /No changes\. (?:Infrastructure is up-to-date\.|Your infrastructure matches the configuration\.)/i.test(
        output
      )
    ) {
      applied = true;
    } else if (
      /Plan: \d+ to add, \d+ to change, \d+ to destroy\./i.test(output)
    ) {
      applied = false;
    } else if (/No changes\./i.test(output)) {
      applied = true;
    }

    return new OpenTofuStatus(
      key,
      lastAction,
      output,
      new Date(),
      null,
      applied
    );
  }

  /**
   * Creates an instance for error scenarios
   * @param {string} key - Execution context key
   * @param {string} output - Command output before error
   * @param {Error} error - Error that occurred
   * @param {string} lastAction - Last action before the error (defaults to 'unknown')
   * @returns {OpenTofuStatus} Status instance representing the error state
   */
  static fromError(key, output, error, lastAction = 'unknown') {
    return new OpenTofuStatus(
      key,
      lastAction,
      output,
      new Date(),
      error,
      false
    );
  }
}

module.exports = OpenTofuStatus;
