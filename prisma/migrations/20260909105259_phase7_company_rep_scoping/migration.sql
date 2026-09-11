-- AlterTable
ALTER TABLE "CompanyRepProfile" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "CompanyRepProfile_companyId_idx" ON "CompanyRepProfile"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyRepProfile" ADD CONSTRAINT "CompanyRepProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
