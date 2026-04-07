#!/usr/bin/env tsx
/**
 * Database backup script — encrypts SQLite database and uploads to B2/S3.
 *
 * Usage: npx tsx scripts/backup-db.ts
 *
 * Required env vars:
 *   BACKUP_ENCRYPTION_KEY  — 32-byte hex key for AES-256-GCM
 *   B2_ENDPOINT            — S3-compatible endpoint (e.g., s3.us-west-004.backblazeb2.com)
 *   B2_KEY_ID              — B2 application key ID
 *   B2_APP_KEY             — B2 application key
 *   B2_BUCKET              — B2 bucket name
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "users.db");

function encrypt(data: Buffer, keyHex: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, iv, tag };
}

async function main() {
  console.log("[BACKUP] Starting database backup...");

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[BACKUP] Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const encKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encKey || encKey.length !== 64) {
    console.error("[BACKUP] BACKUP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).");
    console.log("[BACKUP] Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }

  // Read database file
  const dbData = fs.readFileSync(DB_PATH);
  console.log(`[BACKUP] Database size: ${(dbData.length / 1024).toFixed(1)} KB`);

  // Encrypt
  const { encrypted, iv, tag } = encrypt(dbData, encKey);

  // Write encrypted backup: [12-byte IV][16-byte auth tag][encrypted data]
  const backupData = Buffer.concat([iv, tag, encrypted]);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `vancomyzer-backup-${timestamp}.db.enc`;

  // Try B2 upload if configured
  const { B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY, B2_BUCKET } = process.env;
  if (B2_ENDPOINT && B2_KEY_ID && B2_APP_KEY && B2_BUCKET) {
    try {
      const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({
        endpoint: `https://${B2_ENDPOINT}`,
        region: "us-west-004",
        credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
      });

      // Upload
      await s3.send(new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: backupName,
        Body: backupData,
        ContentType: "application/octet-stream",
      }));
      console.log(`[BACKUP] Uploaded to B2: ${backupName} (${(backupData.length / 1024).toFixed(1)} KB)`);

      // Cleanup: delete backups older than 30 days
      const list = await s3.send(new ListObjectsV2Command({ Bucket: B2_BUCKET, Prefix: "vancomyzer-backup-" }));
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for (const obj of list.Contents ?? []) {
        if (obj.LastModified && obj.LastModified < thirtyDaysAgo && obj.Key) {
          await s3.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: obj.Key }));
          console.log(`[BACKUP] Deleted old backup: ${obj.Key}`);
        }
      }
    } catch (err) {
      console.error("[BACKUP] B2 upload failed:", err);
      process.exit(1);
    }
  } else {
    // Fallback: save locally
    const localPath = path.join(DATA_DIR, backupName);
    fs.writeFileSync(localPath, backupData);
    console.log(`[BACKUP] B2 not configured — saved locally: ${localPath}`);
  }

  console.log("[BACKUP] Complete.");
}

main().catch((err) => {
  console.error("[BACKUP] Fatal error:", err);
  process.exit(1);
});
