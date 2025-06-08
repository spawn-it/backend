const { S3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const streamPipeline = promisify(pipeline);

const s3Client = new S3Client({
  region: process.env.S3_REGION || "eu-central-1",
  forcePathStyle: true,
  endpoint: process.env.S3_URL,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  }
});

// Liste les buckets disponibles
async function listBuckets() {
  const data = await s3Client.send(new ListBucketsCommand({}));
  return data.Buckets.map(b => b.Name);
}

// Liste les clients (préfixes de répertoires clients/)
async function listClients(bucket, basePrefix = 'clients/') {
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: basePrefix,
    Delimiter: '/',
  }));
  return (data.CommonPrefixes || []).map(cp => cp.Prefix.replace(basePrefix, '').replace(/\/$/, ''));
}

// Upload d’un fichier (string ou buffer) vers S3
async function createFile(bucket, key, content) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: "application/json"
  });

  await s3Client.send(command);
}

// Télécharge un fichier et retourne son contenu en texte
async function getFile(bucket, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const data = await s3Client.send(command);

    const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        });

    return streamToString(data.Body);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      const error = new Error(`Key ${key} does not exist in bucket ${bucket}`);
      error.code = 'NoSuchKey';
      throw error;
    }
    throw err;
  }
}

async function listServices(bucket, clientId, basePrefix = 'clients/') {
  const prefix = `${basePrefix}${clientId}/`;
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: '/',
  }));

  const serviceNames = (data.CommonPrefixes || []).map(cp => cp.Prefix.replace(prefix, '').replace(/\/$/, ''));

  const services = {};
  for (const service of serviceNames) {
    const infoKey = `${prefix}${service}/info.json`;
    try {
      const infoContent = await getFile(bucket, infoKey);
      services[service] = JSON.parse(infoContent);
    } catch (err) {
      if (err.code === 'NoSuchKey') {
        services[service] = null;
      } else {
        throw err;
      }
    }
  }

  return services;
}

// Télécharge tous les fichiers d’un préfixe S3 dans un dossier local
async function downloadFiles(bucket, prefix, destinationFolder) {
  await fs.promises.mkdir(destinationFolder, { recursive: true });

  const list = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));

  for (const file of list.Contents || []) {
    const fileKey = file.Key;
    const localFilePath = path.join(
      destinationFolder,
      fileKey.replace(prefix, '')
    );

    const dirName = path.dirname(localFilePath);
    await fs.promises.mkdir(dirName, { recursive: true });

    const data = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey }));
    await streamPipeline(data.Body, fs.createWriteStream(localFilePath));
  }

  return destinationFolder;
}

async function updateInfoJsonStatus(bucket, clientId, serviceId, newStatus) {
  const key = `clients/${clientId}/${serviceId}/info.json`;

  let info = {};
  try {
    const fileContent = await getFile(bucket, key);
    info = JSON.parse(fileContent);
  } catch (err) {
    if (err.code !== 'NoSuchKey') throw err;
    info = {};
  }

  info.status = newStatus;
  
  await createFile(bucket, key, JSON.stringify(info, null, 2));
}

async function updateInfoJsonLastAction(bucket, clientId, serviceId, action) {
  const key = `clients/${clientId}/${serviceId}/info.json`;

  let info = {};
  try {
    const fileContent = await getFile(bucket, key);
    info = JSON.parse(fileContent);
  } catch (err) {
    if (err.code !== 'NoSuchKey') throw err;
    info = {};
  }

  // Mettre à jour seulement le lastAction
  info.lastAction = action;
  
  await createFile(bucket, key, JSON.stringify(info, null, 2));
}

async function deleteServiceFiles(bucket, prefix) {
  try {
    console.log(`[S3] Suppression des fichiers avec préfixe: ${prefix}`);
    
    // Lister tous les objets avec ce préfixe
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log(`[S3] Aucun fichier à supprimer pour le préfixe: ${prefix}`);
      return;
    }

    console.log(`[S3] ${listResponse.Contents.length} fichier(s) à supprimer`);

    for (const object of listResponse.Contents) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: object.Key
      });
      
      await s3Client.send(deleteCommand);
      console.log(`[S3] Fichier supprimé: ${object.Key}`);
    }

    console.log(`[S3] Tous les fichiers supprimés pour: ${prefix}`);
  } catch (err) {
    console.error(`[S3] Erreur lors de la suppression des fichiers ${prefix}:`, err);
    throw err;
  }
}

module.exports = {
  s3Client,
  listBuckets,
  listClients,
  listServices,
  getFile,
  createFile,
  downloadFiles,
  updateInfoJsonStatus,
  updateInfoJsonLastAction,
  deleteServiceFiles
};
