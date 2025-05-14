const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const streamPipeline = promisify(pipeline);

const s3 = new S3Client({
    region: 'eu-west-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function downloadOpenTofuFilesFromS3(bucket, prefix, destinationFolder) {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));

    for (const file of list.Contents) {
        const fileKey = file.Key;
        const localPath = path.join(destinationFolder, path.basename(fileKey));
        const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: fileKey }));
        await streamPipeline(data.Body, fs.createWriteStream(localPath));
    }
}

module.exports = { downloadOpenTofuFilesFromS3 };
