const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const OpenTofuStatus = require('./OpenTofuStatus');

const TOFU_BIN = process.env.TOFU_BIN || 'tofu';

/**
 * OpenTofuCommand class: wraps tofu CLI commands with context (clientId, serviceId, codeDir, dataDir).
 * Le code OpenTofu est dans codeDir, les données client/service dans dataDir.
 */
class OpenTofuCommand {
  /**
   * @param {string} clientId - unique identifier for the client
   * @param {string} serviceId - unique identifier for the service
   * @param {string} codeDir - directory where OpenTofu code is located (./opentofu/)
   * @param {string} dataDir - directory where client/service data is stored (./workdirs/client/service/)
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
    if (this.initialized) return true;

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
        const proc = spawn(TOFU_BIN, args, { cwd: this.codeDir, env });

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

        proc.on('error', (err) => reject(new Error(`Erreur lors de l'initialisation: ${err.message}`)));

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
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Impossible d'initialiser OpenTofu pour ${this.key}`);
    }

    const args = [action];
    
    // CORRECTION: Ajouter le fichier de variables pour toutes les actions
    const tfvarsPath = path.join(this.dataDir, 'terraform.tfvars.json');
    if (fs.existsSync(tfvarsPath)) {
      args.push(`-var-file=${tfvarsPath}`);
      console.log(`[TOFU] Utilisation du fichier de variables: ${tfvarsPath}`);
    }
    
    // Ajouter -auto-approve pour apply et destroy
    if (['apply', 'destroy'].includes(action)) {
      args.push('-auto-approve');
    }

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

    console.log(`[TOFU] Exécution de 'tofu ${args.join(' ')}' pour ${this.key}`);
    return spawn(TOFU_BIN, args, { cwd: this.codeDir, env });
  }

  async runPlan() {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      return OpenTofuStatus.fromError(this.key, '', new Error('initialisation échouée'));
    }

    console.log(`[TOFU] Exécution de 'tofu plan -no-color' pour ${this.key}`);

    return new Promise((resolve) => {
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

      const tfvarsPath = path.join(this.dataDir, 'terraform.tfvars.json');
      const args = ['plan', '-no-color'];
      if (fs.existsSync(tfvarsPath)) {
        args.push(`-var-file=${tfvarsPath}`);
        console.log(`[TOFU] Fichier de variables détecté: ${tfvarsPath}`);
      }

      let output = '';
      let gotOutput = false;

      const hangTimeout = setTimeout(() => {
        if (!gotOutput) {
          console.warn(`[TOFU WARNING] tofu plan semble bloqué pour ${this.key}`);
          proc.stdin.write('\n');
        }
      }, 5000);

      const globalTimeout = setTimeout(() => {
        console.error(`[TOFU] Timeout global pour ${this.key}`);
        proc.kill('SIGTERM');
        resolve(OpenTofuStatus.fromError(this.key, output, new Error('timeout')));
      }, 30000);

      const proc = spawn(TOFU_BIN, args, {
        cwd: this.codeDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdout.on('data', (chunk) => {
        gotOutput = true;
        const data = chunk.toString();
        console.log(`[TOFU OUT] ${data.trim()}`);
        output += data;
      });

      proc.stderr.on('data', (chunk) => {
        gotOutput = true;
        const data = chunk.toString();
        console.error(`[TOFU ERR] ${data.trim()}`);
        output += data;
      });

      proc.on('error', (err) => {
        clearTimeout(globalTimeout);
        clearTimeout(hangTimeout);
        resolve(OpenTofuStatus.fromError(this.key, output, err));
      });

      proc.on('close', (code) => {
        clearTimeout(globalTimeout);
        clearTimeout(hangTimeout);
        if (code !== 0) {
          resolve(OpenTofuStatus.fromError(this.key, output, new Error(`tofu exited with code ${code}`)));
        } else {
          resolve(OpenTofuStatus.fromPlanOutput(this.key, output));
        }
      });
    });
  }
}

module.exports = OpenTofuCommand;