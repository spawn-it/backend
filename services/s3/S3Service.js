/**
 * S3 Service for handling all AWS S3 operations
 * Provides abstraction layer for S3 interactions with object name validation
 */
const {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { DefaultValues, S3Config } = require('../../config/constants');
const PathHelper = require('../../utils/pathHelper');

const streamPipeline = promisify(pipeline);

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || DefaultValues.S3_REGION,
      forcePathStyle: true,
      endpoint: process.env.S3_URL,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
  }

  /**
   * Validates S3 object name for MinIO compatibility
   * @param {string} objectName - Object name to validate
   * @returns {boolean} True if valid
   */
  _isValidObjectName(objectName) {
    // MinIO object name restrictions
    if (!objectName || objectName.length === 0) return false;
    if (objectName.length > 1024) return false;

    // Check for invalid characters - MinIO is more restrictive
    // Allow only: letters, numbers, and safe special characters
    const validPattern = /^[a-zA-Z0-9._\-/]+$/;
    if (!validPattern.test(objectName)) {
      console.log(`[S3Service] Invalid characters in: ${objectName}`);
      return false;
    }

    // Check for specific problematic patterns
    if (objectName.includes('//')) return false; // Double slashes
    if (objectName.startsWith('/')) return false; // Leading slash
    if (objectName.endsWith('/.') || objectName.includes('/./')) return false; // Dot patterns
    if (objectName.includes('../')) return false; // Parent directory references

    return true;
  }

  /**
   * Sanitizes object name for S3/MinIO compatibility
   * @param {string} objectName - Original object name
   * @returns {string} Sanitized object name
   */
  _sanitizeObjectName(objectName) {
    if (!objectName) return '';

    // Replace problematic characters with safe alternatives
    return objectName
      .replace(/[<>:"\\|?*]/g, '_')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .trim();
  }

  /**
   * Lists all available S3 buckets
   * @returns {Promise<string[]>} Array of bucket names
   */
  async listBuckets() {
    const data = await this.client.send(new ListBucketsCommand({}));
    return data.Buckets.map((b) => b.Name);
  }

  /**
   * Lists all clients in a bucket
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<string[]>} Array of client identifiers
   */
  async listClients(bucket) {
    try {
      const data = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: S3Config.BASE_PREFIX,
          Delimiter: '/',
        })
      );
      return (data.CommonPrefixes || []).map((cp) =>
        cp.Prefix.replace(S3Config.BASE_PREFIX, '').replace(/\/$/, '')
      );
    } catch (err) {
      console.error(
        `[S3Service] Error listing clients in bucket ${bucket}:`,
        err
      );
      throw err;
    }
  }

  /**
   * Lists all services for a specific client with object name validation
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>} Object mapping service IDs to their info
   */
  async listServices(bucket, clientId) {
    try {
      // Validate and sanitize the client ID first
      if (!this._isValidObjectName(clientId)) {
        console.warn(`[S3Service] Invalid client ID detected: ${clientId}`);
        return {}; // Return empty services for invalid client ID
      }

      const prefix = `${S3Config.BASE_PREFIX}${clientId}/`;

      // Validate the prefix before using it
      if (!this._isValidObjectName(prefix)) {
        console.warn(`[S3Service] Invalid prefix: ${prefix}`);
        return {};
      }

      console.log(`[S3Service] Listing services with prefix: ${prefix}`);

      const data = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: '/',
        })
      );

      const serviceNames = (data.CommonPrefixes || [])
        .map((cp) => {
          const serviceName = cp.Prefix.replace(prefix, '').replace(/\/$/, '');
          console.log(`[S3Service] Found service: ${serviceName}`);
          return serviceName;
        })
        .filter((serviceName) => {
          const isValid = this._isValidObjectName(serviceName);
          if (!isValid) {
            console.warn(
              `[S3Service] Filtering out invalid service name: ${serviceName}`
            );
          }
          return isValid;
        });

      console.log(`[S3Service] Valid services found: ${serviceNames.length}`);

      const services = {};
      for (const service of serviceNames) {
        try {
          const infoKey = PathHelper.getServiceInfoKey(clientId, service);

          // Validate the complete key path
          if (!this._isValidObjectName(infoKey)) {
            console.warn(
              `[S3Service] Skipping service with invalid key: ${infoKey}`
            );
            continue;
          }

          const infoContent = await this.getFile(bucket, infoKey);
          services[service] = JSON.parse(infoContent);
        } catch (err) {
          if (err.code === 'NoSuchKey') {
            services[service] = null;
          } else if (
            err.name === 'XMinioInvalidObjectName' ||
            err.code === 'InvalidObjectName'
          ) {
            console.warn(
              `[S3Service] Skipping service with invalid object name: ${service}`
            );
            continue;
          } else {
            console.error(
              `[S3Service] Error getting info for service ${service}:`,
              err
            );
            // Continue with other services instead of failing completely
            services[service] = { error: err.message };
          }
        }
      }

      return services;
    } catch (err) {
      // Handle the MinIO specific error more gracefully
      if (err.name === 'XMinioInvalidObjectName') {
        console.error(
          `[S3Service] MinIO rejected the request due to invalid object name for client ${clientId}`
        );
        console.error(
          `[S3Service] This might be due to special characters in the client ID`
        );
        return {}; // Return empty services instead of throwing
      }

      console.error(
        `[S3Service] Error listing services for client ${clientId}:`,
        err
      );
      throw err;
    }
  }

  /**
   * Uploads a file to S3 with object name validation
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @param {string|Buffer} content - File content
   * @param {string} contentType - MIME type
   * @returns {Promise<void>}
   */
  async createFile(bucket, key, content, contentType = 'application/json') {
    // Validate object name
    if (!this._isValidObjectName(key)) {
      const sanitizedKey = this._sanitizeObjectName(key);
      console.warn(
        `[S3Service] Object name sanitized: ${key} -> ${sanitizedKey}`
      );
      key = sanitizedKey;
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  /**
   * Downloads a file from S3 and returns its content as string
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<string>} File content as string
   * @throws {Error} If file doesn't exist (NoSuchKey)
   */
  async getFile(bucket, key) {
    try {
      // Validate object name before attempting to fetch
      if (!this._isValidObjectName(key)) {
        const error = new Error(`Invalid object name: ${key}`);
        error.code = 'InvalidObjectName';
        throw error;
      }

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const data = await this.client.send(command);

      const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () =>
            resolve(Buffer.concat(chunks).toString('utf-8'))
          );
        });

      return streamToString(data.Body);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        const error = new Error(
          `Key ${key} does not exist in bucket ${bucket}`
        );
        error.code = 'NoSuchKey';
        throw error;
      }
      if (
        err.name === 'XMinioInvalidObjectName' ||
        err.code === 'InvalidObjectName'
      ) {
        const error = new Error(`Invalid object name: ${key}`);
        error.code = 'InvalidObjectName';
        throw error;
      }
      throw err;
    }
  }

  /**
   * Downloads all files from an S3 prefix to a local directory with validation
   * @param {string} bucket - S3 bucket name
   * @param {string} prefix - S3 prefix
   * @param {string} destinationFolder - Local destination directory
   * @returns {Promise<string>} Path to destination folder
   */
  async downloadFiles(bucket, prefix, destinationFolder) {
    await fs.promises.mkdir(destinationFolder, { recursive: true });

    const list = await this.client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })
    );

    for (const file of list.Contents || []) {
      const fileKey = file.Key;

      // Skip files with invalid object names
      if (!this._isValidObjectName(fileKey)) {
        console.warn(
          `[S3Service] Skipping file with invalid object name: ${fileKey}`
        );
        continue;
      }

      try {
        const localFilePath = path.join(
          destinationFolder,
          fileKey.replace(prefix, '')
        );

        const dirName = path.dirname(localFilePath);
        await fs.promises.mkdir(dirName, { recursive: true });

        const data = await this.client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey,
          })
        );
        await streamPipeline(data.Body, fs.createWriteStream(localFilePath));
      } catch (err) {
        console.warn(`[S3Service] Failed to download ${fileKey}:`, err.message);
        // Continue with other files
      }
    }

    return destinationFolder;
  }

  /**
   * Updates the status in service info.json file
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {Object} newStatus - New status object
   * @returns {Promise<void>}
   */
  async updateServiceStatus(bucket, clientId, serviceId, newStatus) {
    const key = PathHelper.getServiceInfoKey(clientId, serviceId);

    let info = {};
    try {
      const fileContent = await this.getFile(bucket, key);
      info = JSON.parse(fileContent);
    } catch (err) {
      if (err.code !== 'NoSuchKey' && err.code !== 'InvalidObjectName')
        throw err;
    }

    info.status = newStatus;
    await this.createFile(bucket, key, JSON.stringify(info, null, 2));
  }

  /**
   * Updates the last action in service info.json file
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} action - Last action performed
   * @returns {Promise<void>}
   */
  async updateServiceLastAction(bucket, clientId, serviceId, action) {
    const key = PathHelper.getServiceInfoKey(clientId, serviceId);

    let info = {};
    try {
      const fileContent = await this.getFile(bucket, key);
      info = JSON.parse(fileContent);
    } catch (err) {
      if (err.code !== 'NoSuchKey' && err.code !== 'InvalidObjectName')
        throw err;
    }

    info.lastAction = action;
    await this.createFile(bucket, key, JSON.stringify(info, null, 2));
  }

  async updateServiceLastApplyOutput(bucket, clientId, serviceId, output) {
    const key = PathHelper.getServiceInfoKey(clientId, serviceId);

    let info = {};
    try {
      const fileContent = await this.getFile(bucket, key);
      info = JSON.parse(fileContent);
    } catch (err) {
      if (err.code !== 'NoSuchKey' && err.code !== 'InvalidObjectName')
        throw err;
    }

    info.applyOutput = output;
    await this.createFile(bucket, key, JSON.stringify(info, null, 2));
  }

  /**
   * Gets service info from info.json file
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {Promise<Object>} Service info object
   */
  async getServiceInfo(bucket, clientId, serviceId) {
    const key = PathHelper.getServiceInfoKey(clientId, serviceId);
    const content = await this.getFile(bucket, key);
    return JSON.parse(content);
  }

  /**
   * Deletes all files with a specific prefix with validation
   * @param {string} bucket - S3 bucket name
   * @param {string} prefix - S3 prefix to delete
   * @returns {Promise<void>}
   */
  async deleteServiceFiles(bucket, prefix) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });

      const listResponse = await this.client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return;
      }

      for (const object of listResponse.Contents) {
        // Skip objects with invalid names
        if (!this._isValidObjectName(object.Key)) {
          console.warn(
            `[S3Service] Skipping deletion of invalid object: ${object.Key}`
          );
          continue;
        }

        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: object.Key,
          });

          await this.client.send(deleteCommand);
        } catch (deleteErr) {
          console.warn(
            `[S3Service] Failed to delete ${object.Key}:`,
            deleteErr.message
          );
          // Continue with other files
        }
      }
    } catch (err) {
      console.error(
        `[S3Service] Error deleting files with prefix ${prefix}:`,
        err
      );
      throw err;
    }
  }
}

module.exports = new S3Service();
