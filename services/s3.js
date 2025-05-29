const { S3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
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

// Liste les services d’un client
async function listServices(bucket, clientId, basePrefix = 'clients/') {
  const prefix = `${basePrefix}${clientId}/`;
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: '/',
  }));
  return (data.CommonPrefixes || []).map(cp => cp.Prefix.replace(prefix, '').replace(/\/$/, ''));
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

module.exports = {
  s3Client,
  listBuckets,
  listClients,
  listServices,
  getFile,
  createFile,
  downloadFiles,
};
