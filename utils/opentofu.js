const { spawn } = require('child_process');
const TofuMutex = require('./tofumutex');

/**
 * OpenTofuCommand class: wraps tofu CLI commands with context (clientId, serviceId, workingDir).
 */
class OpenTofuCommand {
  /**
   * @param {string} clientId - unique identifier for the client
   * @param {string} serviceId - unique identifier for the service
   * @param {string} workingDir - directory where tofu CLI commands should run
   */
  constructor(clientId, serviceId, workingDir) {
    this.clientId = clientId;
    this.serviceId = serviceId;
    this.workingDir = workingDir;
    this.key = `${clientId}/${serviceId}`;
    this.mutex = new TofuMutex(workingDir);
    this.initialized = false;
  }

  /**
   * Exécute 'tofu init' avec un mutex pour éviter les conflits
   * @returns {Promise<boolean>} - true si l'initialisation a réussi
   */
  async ensureInitialized() {
    if (this.initialized) {
      return true;
    }

    try {
      const locked = await this.mutex.acquire('init');
      if (!locked) {
        throw new Error(`Impossible d'acquérir le verrou pour l'initialisation (${this.key})`);
      }

      console.log(`[TOFU] Initialisation pour ${this.key}`);
      
      // Exécuter tofu init
      await new Promise((resolve, reject) => {
        const proc = spawn('tofu', ['init'], { cwd: this.workingDir });
        
        let output = '';
        proc.stdout.on('data', (chunk) => {
          const data = chunk.toString();
          output += data;
          console.log(`[TOFU INIT] ${this.key}: ${data.trim()}`);
        });
        
        proc.stderr.on('data', (chunk) => {
          const data = chunk.toString();
          output += data;
          console.error(`[TOFU INIT] ${this.key}: ${data.trim()}`);
        });
        
        proc.on('error', (err) => {
          reject(new Error(`Erreur lors de l'initialisation: ${err.message}`));
        });
        
        proc.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`tofu init exited with code ${code}: ${output}`));
          } else {
            this.initialized = true;
            resolve(true);
          }
        });
      });

      return true;
    } catch (err) {
      console.error(`[TOFU] Erreur lors de l'initialisation pour ${this.key}: ${err.message}`);
      return false;
    } finally {
      await this.mutex.release();
    }
  }

  /**
   * Spawns a tofu command (plan, apply, destroy) with proper initialization.
   * @param {string} action - one of 'plan', 'apply', 'destroy'
   * @returns {Promise<ChildProcess>}
   */
  async spawnCommand(action) {
    // S'assurer que tofu est initialisé avant de lancer une commande
    await this.ensureInitialized();
    
    const args = [action];
    if (['apply', 'destroy'].includes(action)) {
      args.push('-auto-approve');
    }
    return spawn('tofu', args, { cwd: this.workingDir });
  }

  /**
   * Executes 'tofu plan -no-color' and returns the accumulated output.
   * @returns {Promise<string>} output from the plan command
   */
  async runPlan() {
    // S'assurer que tofu est initialisé avant de lancer un plan
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const proc = spawn('tofu', ['plan', '-no-color'], { cwd: this.workingDir });
      let output = '';
      proc.stdout.on('data', (chunk) => output += chunk.toString());
      proc.stderr.on('data', (chunk) => output += chunk.toString());
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`tofu plan exited with code ${code}`));
        }
        resolve(output);
      });
    });
  }
}

module.exports = OpenTofuCommand;