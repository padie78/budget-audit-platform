import type { AppSyncResolverHandler } from 'aws-lambda';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '@budget-audit/infrastructure';
import { v4 as uuidv4 } from 'uuid';

interface SignUploadArgs {
  input: {
    supplierId: string;
    fileName: string;
    contentType: string;
  };
}

interface SignUploadResult {
  uploadUrl: string;
  s3Url: string;
  key: string;
  expiresIn: number;
}

const BUCKET = process.env['BUDGETS_BUCKET'] ?? '';
const URL_TTL = Number(process.env['UPLOAD_URL_TTL_SECONDS'] ?? 900);
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

/**
 * Genera una URL pre-firmada (PUT) para subir el PDF del presupuesto.
 * El frontend la usa para subir directo a S3 sin pasar por el backend.
 * El `s3Url` resultante se envía después en la mutation `auditBudget`.
 */
export const handler: AppSyncResolverHandler<
  SignUploadArgs,
  SignUploadResult
> = async (event) => {
  if (!BUCKET) throw new Error('BUDGETS_BUCKET no configurado.');

  const { supplierId, fileName, contentType } = event.arguments.input;

  if (!supplierId || !fileName) {
    throw new Error('supplierId y fileName son requeridos.');
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Content-Type no permitido: ${contentType}`);
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${supplierId}/${Date.now()}-${uuidv4()}-${safeName}`;

  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_TTL });

  return {
    uploadUrl,
    s3Url: `s3://${BUCKET}/${key}`,
    key,
    expiresIn: URL_TTL,
  };
};
