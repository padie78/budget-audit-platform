import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | undefined;

export function getS3Client(region?: string): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: region ?? process.env['AWS_REGION'] ?? 'us-east-1',
  });
  return s3Client;
}
