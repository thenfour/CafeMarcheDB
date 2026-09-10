-- CreateTable
CREATE TABLE `AdminBootstrapClaim` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` VARCHAR(64) NOT NULL,
    `claimedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedByUserId` INTEGER NOT NULL,

    UNIQUE INDEX `AdminBootstrapClaim_tokenHash_key`(`tokenHash`),
    INDEX `AdminBootstrapClaim_claimedByUserId_idx`(`claimedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
