/*
  Warnings:

  - Added the required column `type` to the `mail_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "mail_tokens" ADD COLUMN     "type" "TokenType" NOT NULL;
