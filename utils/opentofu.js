const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const OpenTofuStatus = require('../models/OpenTofuStatus');

const TOFU_BIN = process.env.TOFU_BIN || 'tofu';

class OpenTofuCommand {
  constructor(clientId, serviceId, codeDir, dataDir) {
    this.clientId = clientId;
    this.serviceId = serviceId;
    this.codeDir = codeDir;
    this.dataDir = dataDir;
    this.key = `${clientId}/${serviceId}`;
    this.initialized = false;
  }

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

  async spawnCommand(action) {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error(`Impossible d'initialiser OpenTofu pour ${this.key}`);
    }

    const args = [action];
    
    const tfvarsPath = path.join(this.dataDir, 'terraform.tfvars.json');
    if (fs.existsSync(tfvarsPath)) {
      args.push(`-var-file=${tfvarsPath}`);
      console.log(`[TOFU] Utilisation du fichier de variables: ${tfvarsPath}`);
      
      try {
        const varsContent = fs.readFileSync(tfvarsPath, 'utf8');
        console.log(`[TOFU DEBUG] Contenu du fichier de variables:`);
        console.log(varsContent);
      } catch (err) {
        console.error(`[TOFU DEBUG] Erreur lecture fichier vars: ${err.message}`);
      }
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

    console.log(`[TOFU DEBUG] Commande complète: ${TOFU_BIN} ${args.join(' ')}`);
    console.log(`[TOFU DEBUG] Répertoire de travail: ${this.codeDir}`);
    console.log(`[TOFU DEBUG] Variables d'environnement TF_*:`);
    Object.keys(env).filter(k => k.startsWith('TF_')).forEach(k => {
      console.log(`  ${k}=${env[k]}`);
    });

    console.log(`[TOFU] Exécution de 'tofu ${args.join(' ')}' pour ${this.key}`);
    
    const proc = spawn(TOFU_BIN, args, { cwd: this.codeDir, env });

    proc.on('spawn', () => {
      console.log(`[TOFU DEBUG] Processus spawné avec PID: ${proc.pid}`);
    });

    proc.on('error', (err) => {
      console.error(`[TOFU DEBUG] Erreur du processus: ${err.message}`);
    });

    proc.on('exit', (code, signal) => {
      console.log(`[TOFU DEBUG] Processus terminé - Code: ${code}, Signal: ${signal}`);
    });

    proc.on('close', (code, signal) => {
      console.log(`[TOFU DEBUG] Processus fermé - Code: ${code}, Signal: ${signal}`);
    });

    proc.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      console.log(`[TOFU STDOUT] ${data}`);
    });

    proc.stderr.on('data', (chunk) => {
      const data = chunk.toString();
      console.log(`[TOFU STDERR] ${data}`);
    });

    let lastOutputTime = Date.now();
    const checkStuck = setInterval(() => {
      const timeSinceOutput = Date.now() - lastOutputTime;
      if (timeSinceOutput > 10000) {
        console.warn(`[TOFU DEBUG] Pas d'output depuis ${timeSinceOutput}ms - processus possiblement bloqué`);
        console.warn(`[TOFU DEBUG] État du processus: killed=${proc.killed}, pid=${proc.pid}`);
      }
    }, 5000);

    proc.stdout.on('data', () => { lastOutputTime = Date.now(); });
    proc.stderr.on('data', () => { lastOutputTime = Date.now(); });

    proc.on('close', () => {
      clearInterval(checkStuck);
    });

    return proc;
  }

  async runPlan() {
    const initialized = await this.ensureInitialized();
    if (!initialized) {
      throw new Error('Initialisation échouée');
    }

    console.log(`[TOFU] Exécution de 'tofu plan -no-color' pour ${this.key}`);

    return new Promise((resolve, reject) => {
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
        reject(new Error('timeout'));
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
        reject(err);
      });

      proc.on('close', (code) => {
        clearTimeout(globalTimeout);
        clearTimeout(hangTimeout);
        if (code !== 0) {
          reject(new Error(`tofu exited with code ${code}: ${output}`));
        } else {
          // Retourner l'output brut, pas un OpenTofuStatus
          resolve(output);
        }
      });
    });
  }

  async isResourceApplied() {
    const env = {
      ...process.env,
      TF_DATA_DIR: path.join(this.dataDir, '.terraform'),
    };
  
    return new Promise((resolve) => {
      const proc = spawn(TOFU_BIN, ['state', 'list'], { cwd: this.codeDir, env });
  
      let output = '';
      proc.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
  
      proc.stderr.on('data', (chunk) => {
        console.error(`[TOFU state ERR] ${chunk.toString().trim()}`);
      });
  
      proc.on('close', (code) => {
        if (code === 0) {
          const hasProviderInfra = output.includes('module.provider_infra_');
          resolve(hasProviderInfra);
        } else {
          resolve(false);
        }
      });
    });
  }
  
}

module.exports = OpenTofuCommand;