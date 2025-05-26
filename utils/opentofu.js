const { spawn } = require('child_process');
const path = require('path');

const TOFU_BIN = process.env.TOFU_BIN || '/usr/local/bin/tofu';

/**
 * OpenTofuCommand class: wraps tofu CLI commands with context (clientId, serviceId, codeDir, dataDir).
 * Le code OpenTofu est dans codeDir, les données client/service dans dataDir.
 */
class OpenTofuCommand {
  /**
   * @param {string} clientId - unique identifier for the client
   * @param {string} serviceId - unique identifier for the service
   * @param {string} codeDir - directory where OpenTofu code is located (/opentofu/)
   * @param {string} dataDir - directory where client/service data is stored (/workdirs/client/service/)
   */
  constructor(clientId, serviceId, codeDir, dataDir) {
    this.clientId = clientId;
    this.serviceId = serviceId;
    this.codeDir = codeDir;
    this.dataDir = dataDir;
    this.key = `${clientId}/${serviceId}`;
    this.initialized = false;
  }

  /**
   * Exécute 'tofu init' dans le répertoire de code avec les bonnes variables d'environnement
   * @returns {Promise<boolean>} - true si l'initialisation a réussi
   */
  async ensureInitialized() {
    if (this.initialized) {
      return true;
    }

    try {
      console.log(`[TOFU] Initialisation pour ${this.key} (code: ${this.codeDir}, data: ${this.dataDir})`);

      const env = {
        ...process.env,
        TF_DATA_DIR: path.join(this.dataDir, '.terraform'),
        TF_VAR_client_id: this.clientId,
        TF_VAR_service_id: this.serviceId,
        TF_VAR_data_dir: this.dataDir,
        TF_VAR_s3_endpoint: process.env.S3_URL,
        TF_VAR_s3_access_key: process.env.S3_ACCESS_KEY,
        TF_VAR_s3_secret_key: process.env.S3_SECRET_KEY
      };

      const args = [
        'init',
        `-backend-config=bucket=${process.env.S3_BUCKET}`,
        `-backend-config=key=clients/${this.clientId}/${this.serviceId}/terraform.tfstate`,
        `-backend-config=region=${process.env.S3_REGION || 'us-east-1'}`,
        `-backend-config=endpoint=${process.env.S3_URL}`,
        `-backend-config=access_key=${process.env.S3_ACCESS_KEY}`,
        `-backend-config=secret_key=${process.env.S3_SECRET_KEY}`,
        `-backend-config=skip_credentials_validation=true`,
        `-backend-config=skip_metadata_api_check=true`,
        `-backend-config=force_path_style=true`
      ];

      await new Promise((resolve, reject) => {
        const proc = spawn(TOFU_BIN, args, {
          cwd: this.codeDir,
          env: env
        });

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
            console.log(`[TOFU] Initialisation réussie pour ${this.key}`);
            resolve(true);
          }
        });
      });

      return true;

    } catch (err) {
      console.error(`[TOFU] Erreur lors de l'initialisation pour ${this.key}: ${err.message}`);
      return false;
    }
  }

  /**
   * Spawns a tofu command (plan, apply, destroy) with proper initialization.
   * @param {string} action - one of 'plan', 'apply', 'destroy'
   * @returns {Promise<ChildProcess>}
   */
  async spawnCommand(action) {
    // S'assurer que tofu est initialisé avant de lancer une commande
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Impossible d'initialiser OpenTofu pour ${this.key}`);
    }

    const args = [action];
    if (['apply', 'destroy'].includes(action)) {
      args.push('-auto-approve');
    }

    // Variables d'environnement avec répertoire de données séparé
    const env = {
      ...process.env,
      TF_DATA_DIR: path.join(this.dataDir, '.terraform'),
      TF_VAR_client_id: this.clientId,
      TF_VAR_service_id: this.serviceId,
      TF_VAR_data_dir: this.dataDir,
      TF_VAR_s3_endpoint: process.env.S3_URL,
      TF_VAR_s3_access_key: process.env.S3_ACCESS_KEY,
      TF_VAR_s3_secret_key: process.env.S3_SECRET_KEY
    };

    console.log(`[TOFU] Exécution de 'tofu ${args.join(' ')}' pour ${this.key} (code: ${this.codeDir}, data: ${this.dataDir})`);
    return spawn(TOFU_BIN, args, {
      cwd: this.codeDir,
      env: env
    });
  }

  /**
   * Executes 'tofu plan -no-color' and returns the accumulated output.
   * @returns {Promise<string>} output from the plan command
   */
  async runPlan() {
    // S'assurer que tofu est initialisé avant de lancer un plan
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Impossible d'initialiser OpenTofu pour ${this.key}`);
    }

    console.log(`[TOFU] Exécution de 'tofu plan -no-color' pour ${this.key} (code: ${this.codeDir}, data: ${this.dataDir})`);

    return new Promise((resolve, reject) => {
      // Variables d'environnement avec répertoire de données séparé
      const env = {
        ...process.env,
        TF_DATA_DIR: path.join(this.dataDir, '.terraform'),
        TF_VAR_client_id: this.clientId,
        TF_VAR_service_id: this.serviceId,
        TF_VAR_data_dir: this.dataDir,
        TF_VAR_s3_endpoint: process.env.S3_URL,
        TF_VAR_s3_access_key: process.env.S3_ACCESS_KEY,
        TF_VAR_s3_secret_key: process.env.S3_SECRET_KEY
      };

      const proc = spawn(TOFU_BIN, ['plan', '-no-color'], {
        cwd: this.codeDir,
        env: env
      });
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
