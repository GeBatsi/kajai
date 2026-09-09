-- CreateTable
CREATE TABLE "mail_tokens" (
    "id" TEXT NOT NULL,
    "mailToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "mail_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_tokens_mailToken_key" ON "mail_tokens"("mailToken");

-- CreateIndex
CREATE INDEX "mail_tokens_mailToken_idx" ON "mail_tokens"("mailToken");

-- CreateIndex
CREATE INDEX "mail_tokens_userId_idx" ON "mail_tokens"("userId");

-- AddForeignKey
ALTER TABLE "mail_tokens" ADD CONSTRAINT "mail_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
