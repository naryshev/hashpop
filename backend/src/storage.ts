import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
const publicBaseUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "") ?? "";
const region = process.env.S3_REGION ?? "us-east-1";
const endpoint = process.env.S3_ENDPOINT || undefined;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

const useS3 =
  Boolean(bucket) &&
  Boolean(publicBaseUrl) &&
  Boolean(accessKeyId) &&
  Boolean(secretAccessKey);

let s3Client: S3Client | null = null;
if (useS3) {
  s3Client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
}

/**
 * Save an upload and return its public URL.
 * If S3 is configured (S3_BUCKET, S3_PUBLIC_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY), uploads to S3.
 * Otherwise writes to uploadsDir and returns baseUrl + /uploads/filename.
 */
export async function saveUpload(
  buffer: Buffer,
  filename: string,
  contentType: string,
  baseUrl: string,
  uploadsDir: string
): Promise<string> {
  if (useS3 && s3Client) {
    const key = `uploads/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `${publicBaseUrl}/${key}`;
  }
  const dest = path.join(uploadsDir, filename);
  fs.writeFileSync(dest, buffer);
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/uploads/${filename}`;
}

export function isS3Configured(): boolean {
  return useS3;
}
