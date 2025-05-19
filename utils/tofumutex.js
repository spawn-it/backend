const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const lockfile = require('proper-lockfile');
const sleep = promisify(setTimeout);

/**
 * Classe pour gérer le verrouillage des opérations OpenTofu
 * Utilise proper-lockfile pour implémenter un système de mutex basé sur des fichiers
 */
class TofuMutex {
  /**
   * @param {string} workingDir - Le répertoire de travail
   * @param {number} retryCount - Nombre de tentatives de verrouillage (défaut: 10)
   * @param {number} retryDelay - Délai entre les tentatives en ms (défaut: 1000)
   */
  constructor(workingDir, retryCount = 10, retryDelay = 1000) {
    this.workingDir = workingDir;
    this.lockPath = path.join(workingDir, '.terraform.lock');
    this.retryCount = retryCount;
    this.retryDelay = retryDelay;
    this.releaseFn = null;
  }

  /**
   * Acquérir le verrou pour le répertoire de travail
   * @param {string} operation - Nom de l'opération pour le logging
   * @returns {Promise<boolean>} - True si le verrou a été acquis avec succès
   */
  async acquire(operation = 'unknown') {
    console.log(`[MUTEX] Tentative d'acquisition du verrou pour ${this.workingDir} (opération: ${operation})`);
    
    // S'assurer que le répertoire existe pour le fichier de verrouillage
    await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
    
    // Toucher le fichier de verrouillage s'il n'existe pas
    try {
      await fs.access(this.lockPath);
    } catch (err) {
      // Le fichier n'existe pas, le créer
      await fs.writeFile(this.lockPath, '', { flag: 'wx' }).catch(() => {});
    }
    
    // Essayer d'acquérir le verrou avec des tentatives
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        this.releaseFn = await lockfile.lock(this.lockPath, {
          retries: {
            retries: 0,  // Pas de nouvelles tentatives ici, nous gérons manuellement
            factor: 1,
            minTimeout: 1,
            maxTimeout: 1,
          },
          stale: 30000,  // Considérer le verrou comme obsolète après 30s (au cas où un processus meurt)
        });
        console.log(`[MUTEX] Verrou acquis pour ${this.workingDir} (tentative ${attempt})`);
        return true;
      } catch (err) {
        if (attempt < this.retryCount) {
          console.log(`[MUTEX] Échec d'acquisition du verrou, tentative ${attempt}/${this.retryCount}, nouvelle tentative dans ${this.retryDelay}ms...`);
          await sleep(this.retryDelay);
        } else {
          console.error(`[MUTEX] Impossible d'acquérir le verrou après ${this.retryCount} tentatives`);
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Libérer le verrou
   * @returns {Promise<void>}
   */
  async release() {
    if (this.releaseFn) {
      try {
        await this.releaseFn();
        console.log(`[MUTEX] Verrou libéré pour ${this.workingDir}`);
        this.releaseFn = null;
      } catch (err) {
        console.error(`[MUTEX] Erreur lors de la libération du verrou: ${err.message}`);
      }
    }
  }
}

module.exports = TofuMutex;