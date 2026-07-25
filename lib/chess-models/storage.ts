import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REQUIRED = ['MODEL_STORAGE_BUCKET', 'MODEL_STORAGE_REGION', 'MODEL_STORAGE_ACCESS_KEY_ID', 'MODEL_STORAGE_SECRET_ACCESS_KEY'] as const

export function modelStorageConfigured() {
  return REQUIRED.every(key => Boolean(process.env[key]))
}

export async function createQuarantineUpload(input: {
  objectKey: string
  contentLength: number
  sha256: string
}) {
  if (!modelStorageConfigured()) throw new Error('Direct model storage is not configured')

  const client = new S3Client({
    region: process.env.MODEL_STORAGE_REGION!,
    endpoint: process.env.MODEL_STORAGE_ENDPOINT || undefined,
    forcePathStyle: process.env.MODEL_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.MODEL_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.MODEL_STORAGE_SECRET_ACCESS_KEY!,
    },
  })
  const command = new PutObjectCommand({
    Bucket: process.env.MODEL_STORAGE_BUCKET!,
    Key: `quarantine/${input.objectKey}`,
    ContentLength: input.contentLength,
    ContentType: 'application/octet-stream',
    ChecksumSHA256: Buffer.from(input.sha256, 'hex').toString('base64'),
    Metadata: { expectedSha256: input.sha256, lifecycle: 'quarantine' },
  })
  return getSignedUrl(client, command, { expiresIn: 900 })
}
