-- AlterTable
ALTER TABLE `permission` ADD COLUMN `significance` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `role` ADD COLUMN `significance` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Permission_significance_idx` ON `Permission`(`significance`);

-- CreateIndex
CREATE INDEX `Role_significance_idx` ON `Role`(`significance`);
