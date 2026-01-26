"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createS3Client = exports.getBucketConfig = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
function getBucketConfig() {
    return {
        bucketName: process.env.AWS_BUCKET_NAME ?? "",
        folderPrefix: process.env.AWS_FOLDER_PREFIX ?? ""
    };
}
exports.getBucketConfig = getBucketConfig;
function createS3Client() {
    return new client_s3_1.S3Client({});
}
exports.createS3Client = createS3Client;
