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

async function listBuckets() {
  const data = await s3Client.send(new ListBucketsCommand({}));
  return data.Buckets.map(b => b.Name);
}

async function listClients(bucket, basePrefix = 'clients/') {
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: basePrefix,
    Delimiter: '/',
  }));
  return (data.CommonPrefixes || []).map(cp => cp.Prefix.replace(basePrefix, '').replace(/\/$/, ''));
}

/**
 * Upload a file (stringified JSON or text) to S3 at the given key.
 * @param {string} bucket - Name of the S3 bucket
 * @param {string} key - Full S3 path (e.g. "clients/foo/service/instance.json")
 * @param {string|Buffer} content - Content to upload (usually JSON.stringify(...))
 */
async function createFile(bucket, key, content) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: "application/json"
  });

  await s3Client.send(command);
}

async function listServices(bucket, clientId, basePrefix = 'clients/') {
  const prefix = `${basePrefix}${clientId}/`;
  const data = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: '/',
  }));
  return (data.CommonPrefixes || []).map(cp => cp.Prefix.replace(prefix, '').replace(/\/$/, ''));
}

async function downloadFiles(bucket, prefix, destinationFolder) {
  await fs.promises.mkdir(destinationFolder, { recursive: true });
  
  const list = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  
  for (const file of list.Contents || []) {
    const fileKey = file.Key;
    const localFilePath = path.join(
      destinationFolder, 
      fileKey.replace(prefix, '')
    );
    
    // Create subdirectories if needed
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
  createFile,
  downloadFiles,
};