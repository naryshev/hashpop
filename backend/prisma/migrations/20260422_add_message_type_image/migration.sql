-- AlterTable: add type and imageUrl to Message
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
