import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible, so the AWS SDK's S3 client talks to it
// directly — only the endpoint differs from real S3. Keys are namespaced by
// kind (audio/, artwork/) inside a single bucket; the DB only ever stores the
// bare filename (see db.ts), and these prefixes are applied here so the
// storage layer stays the sole place that knows about R2 key shape.
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET_NAME;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing R2 configuration — set R2_ACCOUNT_ID, R2_BUCKET_NAME, " +
      "R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env",
  );
}

export const AUDIO_PREFIX = "audio/";
export const ARTWORK_PREFIX = "artwork/";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export function audioKey(filename: string): string {
  return `${AUDIO_PREFIX}${filename}`;
}

export function artworkKey(filename: string): string {
  return `${ARTWORK_PREFIX}${filename}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Fetch an object for streaming to an HTTP response. Pass an HTTP `Range`
 * header value straight through — R2 mirrors S3's range semantics (normal,
 * open-ended, and suffix ranges), so no manual byte-range math is needed here.
 * Throws (NoSuchKey / InvalidRange, both surfaced with a `name` property) on
 * a missing object or an unsatisfiable range — callers translate those to
 * 404/416.
 */
export async function getObject(
  key: string,
  range?: string,
): Promise<GetObjectCommandOutput> {
  return r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
  );
}
