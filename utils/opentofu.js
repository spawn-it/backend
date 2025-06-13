/**
 * OpenTofu Command Executor
 * Handles OpenTofu/Terraform command execution with minimal logging
 * Manages initialization, plan, apply, and destroy operations
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DefaultValues } = require('../config/constants');

class OpenTofuCommand {
  constructor(clientId, serviceId, codeDir, dataDir) {
    this.clientId = clientId;
    this.serviceId = serviceId;
    this.codeDir = codeDir;
    this.dataDir = dataDir;
    this.key = `${clientId}/${serviceId}`;
    this.initialized = false;
    this.tofuBin = process.env.TOFU_BIN || 'tofu';
  }

  /**
   * Ensures OpenTofu is initialized for this service
   * Sets up backend configuration and validates environment
   * @returns {Promise<boolean>} True if initialization successful
   */
  async ensureInitialized() {
    if (this.initialized) return true;

    try {
      const env = this._getEnvironmentVariables();
      const args = this._getInitArgs();

      await this._executeCommand('init', args, env, true);
      this.initialized = true;
      return true;
    } catch (err) {
      console.error(
        `[OpenTofu] Initialization failed for ${this.key}:`,
        err.message
      );
      return false;
    }
  }

  /**
   * Retrieves OpenTofu outputs and returns them as clean values
   * @returns {Promise<Object>} Object containing output values (not the full Terraform structure)
   */
  async spawnOutput() {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Unable to initialize OpenTofu for ${this.key}`);
    }

    return new Promise((resolve, reject) => {
      const env = this._getEnvironmentVariables();
      const args = ['output', '-json'];

      console.log(`[OpenTofu] Retrieving outputs for ${this.key}`);

      let output = '';
      let errorOutput = '';

      const proc = spawn(this.tofuBin, args, {
        cwd: this.codeDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set timeout for the operation
      const timeout = setTimeout(() => {
        console.warn(`[OpenTofu] Output retrieval timeout for ${this.key}`);
        proc.kill('SIGTERM');

        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);

        reject(new Error('Output retrieval timed out'));
      }, 30000); // 30 second timeout

      proc.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString();
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        console.error(
          `[OpenTofu] Output command error for ${this.key}:`,
          err.message
        );
        reject(new Error(`Output retrieval failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          // Handle common error cases
          if (
            errorOutput.includes('No state file was found') ||
            errorOutput.includes('The state file is empty')
          ) {
            console.warn(
              `[OpenTofu] No outputs available for ${this.key} (no state or empty state)`
            );
            resolve({}); // Return empty object instead of failing
            return;
          }

          console.error(
            `[OpenTofu] Output retrieval failed for ${this.key} (exit code: ${code})`
          );
          console.error(`[OpenTofu] Error output: ${errorOutput}`);
          reject(
            new Error(
              `Output retrieval failed with exit code ${code}: ${errorOutput}`
            )
          );
          return;
        }

        try {
          // Parse the JSON output
          if (!output.trim()) {
            console.warn(`[OpenTofu] Empty output received for ${this.key}`);
            resolve({});
            return;
          }

          const rawOutputs = JSON.parse(output);

          // Check if outputs object is empty
          if (Object.keys(rawOutputs).length === 0) {
            console.log(`[OpenTofu] No outputs defined for ${this.key}`);
            resolve({});
            return;
          }

          // Extract only the values from the Terraform output structure
          const cleanOutputs = this._extractOutputValues(rawOutputs);

          console.log(
            `[OpenTofu] Successfully retrieved ${Object.keys(cleanOutputs).length} outputs for ${this.key}`
          );
          resolve(cleanOutputs);
        } catch (parseError) {
          console.error(
            `[OpenTofu] Failed to parse output JSON for ${this.key}:`,
            parseError.message
          );
          console.error(`[OpenTofu] Raw output was:`, output);
          reject(
            new Error(`Failed to parse output JSON: ${parseError.message}`)
          );
        }
      });
    });
  }

  /**
   * Extracts clean values from Terraform output structure
   * @private
   * @param {Object} rawOutputs - Raw Terraform outputs with metadata
   * @returns {Object} Clean object containing only the values
   */
  _extractOutputValues(rawOutputs) {
    const cleanOutputs = {};

    for (const [key, outputObj] of Object.entries(rawOutputs)) {
      if (
        outputObj &&
        typeof outputObj === 'object' && Object.prototype.hasOwnProperty.call(outputObj, 'value')
      ) {
        cleanOutputs[key] = outputObj.value;
      } else {
        // Fallback: if structure is unexpected, include the raw value
        console.warn(
          `[OpenTofu] Unexpected output structure for ${key}, using raw value`
        );
        cleanOutputs[key] = outputObj;
      }
    }

    return cleanOutputs;
  }

  /**
   * Spawns an OpenTofu command process with timeout and monitoring
   * @param {string} action - Action to execute (plan, apply, destroy)
   * @returns {Promise<ChildProcess>} Spawned process
   */
  async spawnCommand(action) {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Unable to initialize OpenTofu for ${this.key}`);
    }

    const args = this._getActionArgs(action);
    const env = this._getEnvironmentVariables();

    console.log(`[OpenTofu] Executing '${action}' for ${this.key}`);

    const proc = spawn(this.tofuBin, args, {
      cwd: this.codeDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'], // Ensure we can interact with stdin
    });

    // Set up monitoring for stuck processes
    this._setupProcessMonitoring(proc, action);

    return proc;
  }

  /**
   * Sets up monitoring for processes that might get stuck
   * @private
   * @param {ChildProcess} proc - Process to monitor
   * @param {string} action - Action being executed
   */
  _setupProcessMonitoring(proc, action) {
    let lastOutputTime = Date.now();
    let hasOutput = false;

    // Monitor for output
    const updateLastOutput = () => {
      lastOutputTime = Date.now();
      hasOutput = true;
    };

    proc.stdout.on('data', updateLastOutput);
    proc.stderr.on('data', updateLastOutput);

    // Check for stuck processes every 10 seconds
    const stuckInterval = setInterval(() => {
      const timeSinceOutput = Date.now() - lastOutputTime;

      if (timeSinceOutput > 15000 && hasOutput) {
        // 15 seconds since last output
        console.warn(
          `[OpenTofu] Process appears stuck for ${this.key} (${action})`
        );
        console.warn(
          `[OpenTofu] Sending newline to potentially unstick process...`
        );

        // Try to unstick by sending newlines
        try {
          proc.stdin.write('\n');
          proc.stdin.write('yes\n'); // In case it's waiting for confirmation
        } catch (err) {
          console.warn(
            `[OpenTofu] Could not write to process stdin:`,
            err.message
          );
        }
      }

      if (timeSinceOutput > 45000) {
        // 45 seconds total timeout
        console.error(
          `[OpenTofu] Killing stuck process for ${this.key} (${action})`
        );
        clearInterval(stuckInterval);
        proc.kill('SIGTERM');

        // Force kill if SIGTERM doesn't work
        setTimeout(() => {
          if (!proc.killed) {
            console.error(`[OpenTofu] Force killing process for ${this.key}`);
            proc.kill('SIGKILL');
          }
        }, 5000);
      }
    }, 10000);

    // Clean up interval when process ends
    proc.on('close', () => {
      clearInterval(stuckInterval);
    });

    proc.on('error', (err) => {
      console.error(`[OpenTofu] Process error for ${this.key}:`, err.message);
      clearInterval(stuckInterval);
    });

    // Log completion
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(
          `[OpenTofu] Process exited with code ${code} for ${this.key} (${action})`
        );
      } else {
        console.log(
          `[OpenTofu] ${action} completed successfully for ${this.key}`
        );
      }
    });
  }

  /**
   * Runs a plan operation and returns the output
   * @returns {Promise<string>} Plan output as string
   */
  async runPlan() {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error('Initialization failed');
    }

    return new Promise((resolve, reject) => {
      const env = this._getEnvironmentVariables();
      const args = this._getPlanArgs();

      let output = '';
      let hasError = false;
      let lastOutputTime = Date.now();

      // Set timeout for hung processes
      const timeout = setTimeout(() => {
        console.warn(
          `[OpenTofu] Plan timeout for ${this.key}, killing process`
        );
        proc.kill('SIGTERM');

        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);

        reject(new Error('Plan operation timed out'));
      }, 60000); // 60 second timeout for plans

      const proc = spawn(this.tofuBin, args, {
        cwd: this.codeDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Monitor for stuck processes
      const stuckCheck = setInterval(() => {
        const timeSinceOutput = Date.now() - lastOutputTime;
        if (timeSinceOutput > 20000) {
          // 20 seconds without output
          console.warn(
            `[OpenTofu] Plan seems stuck for ${this.key}, sending newline...`
          );
          try {
            proc.stdin.write('\n');
          } catch {
            // Ignore stdin errors
          }
        }
      }, 10000);

      proc.stdout.on('data', (chunk) => {
        lastOutputTime = Date.now();
        output += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        lastOutputTime = Date.now();
        const errorData = chunk.toString();
        output += errorData;

        // Only log critical errors, not warnings
        if (errorData.toLowerCase().includes('error')) {
          hasError = true;
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        clearInterval(stuckCheck);
        reject(new Error(`Plan execution failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        clearInterval(stuckCheck);

        if (code !== 0) {
          console.error(
            `[OpenTofu] Plan failed for ${this.key} (exit code: ${code})`
          );
          reject(new Error(`Plan failed with exit code ${code}`));
        } else if (hasError) {
          console.warn(
            `[OpenTofu] Plan completed with warnings for ${this.key}`
          );
          resolve(output);
        } else {
          resolve(output);
        }
      });
    });
  }

  /**
   * Constructs environment variables for OpenTofu execution
   * @private
   * @returns {Object} Environment variables object
   */
  _getEnvironmentVariables() {
    return {
      ...process.env,
      TF_DATA_DIR: path.join(this.dataDir, '.terraform'),
      TF_VAR_client_id: this.clientId,
      TF_VAR_service_id: this.serviceId,
      TF_VAR_data_dir: this.dataDir,
      TF_VAR_s3_endpoint: process.env.S3_URL,
      TF_VAR_s3_access_key: process.env.S3_ACCESS_KEY,
      TF_VAR_s3_secret_key: process.env.S3_SECRET_KEY,
    };
  }

  /**
   * Constructs initialization arguments for OpenTofu
   * @private
   * @returns {string[]} Array of init arguments
   */
  _getInitArgs() {
    return [
      'init',
      `-backend-config=bucket=${process.env.S3_BUCKET}`,
      `-backend-config=key=clients/${this.clientId}/${this.serviceId}/terraform.tfstate`,
      `-backend-config=region=${process.env.S3_REGION || DefaultValues.REGION}`,
      `-backend-config=endpoint=${process.env.S3_URL}`,
      `-backend-config=access_key=${process.env.S3_ACCESS_KEY}`,
      `-backend-config=secret_key=${process.env.S3_SECRET_KEY}`,
      `-backend-config=skip_credentials_validation=true`,
      `-backend-config=skip_metadata_api_check=true`,
      `-backend-config=force_path_style=true`,
    ];
  }

  /**
   * Constructs arguments for action commands (apply, destroy)
   * @private
   * @param {string} action - Action to execute
   * @returns {string[]} Array of command arguments
   */
  _getActionArgs(action) {
    const args = [action];

    const tfvarsPath = path.join(this.dataDir, 'terraform.tfvars.json');
    if (fs.existsSync(tfvarsPath)) {
      args.push(`-var-file=${tfvarsPath}`);
    }

    // Add auto-approve for apply and destroy
    if (['apply', 'destroy'].includes(action)) {
      args.push('-auto-approve');
    }

    return args;
  }

  /**
   * Constructs arguments for plan command
   * @private
   * @returns {string[]} Array of plan arguments
   */
  _getPlanArgs() {
    const args = ['plan', '-no-color'];

    const tfvarsPath = path.join(this.dataDir, 'terraform.tfvars.json');
    if (fs.existsSync(tfvarsPath)) {
      args.push(`-var-file=${tfvarsPath}`);
    }

    return args;
  }

  /**
   * Executes a command and returns a promise
   * @private
   * @param {string} command - Command name for logging
   * @param {string[]} args - Command arguments
   * @param {Object} env - Environment variables
   * @param {boolean} logOutput - Whether to log command output
   * @returns {Promise<string>} Command output
   */
  _executeCommand(command, args, env, logOutput = false) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.tofuBin, args, { cwd: this.codeDir, env });

      let output = '';

      proc.stdout.on('data', (chunk) => {
        const data = chunk.toString();
        output += data;
        if (logOutput) {
          // Only log important init messages
          const lines = data
            .split('\n')
            .filter(
              (line) =>
                line.includes('Initializing') ||
                line.includes('Successfully') ||
                line.includes('Error')
            );
          lines.forEach((line) => {
            if (line.trim()) console.log(`[OpenTofu] ${line.trim()}`);
          });
        }
      });

      proc.stderr.on('data', (chunk) => {
        const data = chunk.toString();
        output += data;
        if (logOutput && data.toLowerCase().includes('error')) {
          console.error(`[OpenTofu] ${data.trim()}`);
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`${command} execution failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`${command} exited with code ${code}`));
        } else {
          if (logOutput) {
            console.log(
              `[OpenTofu] ${command} completed successfully for ${this.key}`
            );
          }
          resolve(output);
        }
      });
    });
  }
}

module.exports = OpenTofuCommand;
