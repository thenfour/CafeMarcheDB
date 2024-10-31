/*
  Warnings:

  - You are about to alter the column `frontpageDate` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageTime` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageDetails` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageTitle` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageLocation` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageLocationURI` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - You are about to alter the column `frontpageTags` on the `event` table. The data in that column could be lost. The data in that column will be cast from `VarChar(768)` to `VarChar(300)`.
  - A unique constraint covering the columns `[uid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `uid` on TABLE `Event` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Event` ADD COLUMN `frontpageDate_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageDate_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageDetails_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageDetails_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageLocationURI_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageLocationURI_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageLocation_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageLocation_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTags_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTags_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTime_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTime_nl` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTitle_fr` VARCHAR(300) NULL,
    ADD COLUMN `frontpageTitle_nl` VARCHAR(300) NULL,
    ADD COLUMN `workflowDefId` INTEGER NULL,
    ADD COLUMN `workflowInstanceId` INTEGER NULL,
    MODIFY `frontpageDate` VARCHAR(300) NOT NULL DEFAULT '',
    MODIFY `frontpageTime` VARCHAR(300) NOT NULL DEFAULT '',
    MODIFY `frontpageDetails` VARCHAR(300) NOT NULL DEFAULT '',
    MODIFY `frontpageTitle` VARCHAR(300) NULL,
    MODIFY `frontpageLocation` VARCHAR(300) NULL,
    MODIFY `frontpageLocationURI` VARCHAR(300) NULL,
    MODIFY `frontpageTags` VARCHAR(300) NULL,
    MODIFY `uid` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `EventSonglist` ADD COLUMN `isActuallyPlayed` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isOrdered` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `EventUserResponse` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `uid` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `FrontpageGalleryItem` ADD COLUMN `caption_fr` MEDIUMTEXT NULL,
    ADD COLUMN `caption_nl` MEDIUMTEXT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `uid` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EventCustomField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `dataType` MEDIUMTEXT NOT NULL,
    `optionsJson` MEDIUMTEXT NULL,
    `color` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `significance` VARCHAR(191) NULL,
    `iconName` VARCHAR(191) NULL,
    `isVisibleOnEventPage` BOOLEAN NOT NULL DEFAULT true,

    INDEX `EventCustomField_name_idx`(`name`),
    INDEX `EventCustomField_sortOrder_idx`(`sortOrder`),
    INDEX `EventCustomField_significance_idx`(`significance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventCustomFieldValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `customFieldId` INTEGER NOT NULL,
    `jsonValue` MEDIUMTEXT NOT NULL,
    `dataType` MEDIUMTEXT NOT NULL,

    INDEX `EventCustomFieldValue_eventId_idx`(`eventId`),
    INDEX `EventCustomFieldValue_customFieldId_idx`(`customFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventSongListDivider` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subtitle` MEDIUMTEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `eventSongListId` INTEGER NOT NULL,

    INDEX `EventSongListDivider_sortOrder_idx`(`sortOrder`),
    INDEX `EventSongListDivider_eventSongListId_idx`(`eventSongListId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDef` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(768) NULL,
    `isDefaultForEvents` BOOLEAN NOT NULL,

    INDEX `WorkflowDef_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDefGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workflowDefId` INTEGER NOT NULL,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `color` VARCHAR(768) NULL,
    `positionX` DOUBLE NULL,
    `positionY` DOUBLE NULL,
    `width` DOUBLE NULL,
    `height` DOUBLE NULL,
    `selected` BOOLEAN NOT NULL,

    INDEX `WorkflowDefGroup_name_idx`(`name`),
    INDEX `WorkflowDefGroup_selected_idx`(`selected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDefNode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(768) NOT NULL,
    `description` MEDIUMTEXT NOT NULL,
    `groupId` INTEGER NULL,
    `workflowDefId` INTEGER NULL,
    `displayStyle` VARCHAR(768) NOT NULL,
    `manualCompletionStyle` VARCHAR(768) NOT NULL,
    `thisNodeProgressWeight` INTEGER NOT NULL,
    `relevanceCriteriaType` VARCHAR(768) NOT NULL,
    `activationCriteriaType` VARCHAR(768) NOT NULL,
    `completionCriteriaType` VARCHAR(768) NOT NULL,
    `fieldName` VARCHAR(768) NULL,
    `fieldValueOperator` VARCHAR(768) NULL,
    `fieldValueOperand2` MEDIUMTEXT NULL,
    `defaultDueDateDurationDaysAfterStarted` INTEGER NULL,
    `positionX` DOUBLE NULL,
    `positionY` DOUBLE NULL,
    `width` DOUBLE NULL,
    `height` DOUBLE NULL,
    `selected` BOOLEAN NOT NULL,

    INDEX `WorkflowDefNode_name_idx`(`name`),
    INDEX `WorkflowDefNode_workflowDefId_idx`(`workflowDefId`),
    INDEX `WorkflowDefNode_groupId_idx`(`groupId`),
    INDEX `WorkflowDefNode_displayStyle_idx`(`displayStyle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDefNodeDefaultAssignee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nodeDefId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `WorkflowDefNodeDefaultAssignee_nodeDefId_idx`(`nodeDefId`),
    INDEX `WorkflowDefNodeDefaultAssignee_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDefNodeDependency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `selected` BOOLEAN NOT NULL,
    `determinesRelevance` BOOLEAN NOT NULL,
    `determinesActivation` BOOLEAN NOT NULL,
    `determinesCompleteness` BOOLEAN NOT NULL,
    `sourceNodeDefId` INTEGER NOT NULL,
    `targetNodeDefId` INTEGER NOT NULL,

    INDEX `WorkflowDefNodeDependency_selected_idx`(`selected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowInstance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `lastEvaluatedWorkflowDefId` INTEGER NULL,

    INDEX `WorkflowInstance_lastEvaluatedWorkflowDefId_idx`(`lastEvaluatedWorkflowDefId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowInstanceLogItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instanceId` INTEGER NOT NULL,
    `at` DATETIME(3) NOT NULL,
    `type` VARCHAR(768) NOT NULL,
    `nodeDefId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `fieldName` VARCHAR(768) NULL,
    `oldValue` MEDIUMTEXT NULL,
    `newValue` MEDIUMTEXT NULL,
    `comment` MEDIUMTEXT NULL,

    INDEX `WorkflowInstanceLogItem_instanceId_idx`(`instanceId`),
    INDEX `WorkflowInstanceLogItem_nodeDefId_idx`(`nodeDefId`),
    INDEX `WorkflowInstanceLogItem_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowInstanceNode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instanceId` INTEGER NOT NULL,
    `nodeDefId` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `activeStateFirstTriggeredAt` DATETIME(3) NULL,
    `manuallyCompleted` BOOLEAN NOT NULL,
    `manualCompletionComment` MEDIUMTEXT NULL,
    `lastFieldName` VARCHAR(768) NULL,
    `lastFieldValueAsString` MEDIUMTEXT NULL,
    `lastProgressState` VARCHAR(768) NULL,

    INDEX `WorkflowInstanceNode_instanceId_idx`(`instanceId`),
    INDEX `WorkflowInstanceNode_nodeDefId_idx`(`nodeDefId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowInstanceNodeLastAssignee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `instanceNodeId` INTEGER NOT NULL,

    INDEX `WorkflowInstanceNodeLastAssignee_userId_idx`(`userId`),
    INDEX `WorkflowInstanceNodeLastAssignee_instanceNodeId_idx`(`instanceNodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowInstanceNodeAssignee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `instanceNodeId` INTEGER NOT NULL,

    INDEX `WorkflowInstanceNodeAssignee_userId_idx`(`userId`),
    INDEX `WorkflowInstanceNodeAssignee_instanceNodeId_idx`(`instanceNodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Event_workflowInstanceId_idx` ON `Event`(`workflowInstanceId`);

-- CreateIndex
CREATE INDEX `Event_workflowDefId_idx` ON `Event`(`workflowDefId`);

-- CreateIndex
CREATE INDEX `EventSongListSong_sortOrder_idx` ON `EventSongListSong`(`sortOrder`);

-- CreateIndex
CREATE INDEX `MenuLink_caption_idx` ON `MenuLink`(`caption`);

-- CreateIndex
CREATE INDEX `MenuLink_realm_idx` ON `MenuLink`(`realm`);

-- CreateIndex
CREATE UNIQUE INDEX `User_uid_key` ON `User`(`uid`);

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_workflowInstanceId_fkey` FOREIGN KEY (`workflowInstanceId`) REFERENCES `WorkflowInstance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_workflowDefId_fkey` FOREIGN KEY (`workflowDefId`) REFERENCES `WorkflowDef`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventCustomFieldValue` ADD CONSTRAINT `EventCustomFieldValue_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventCustomFieldValue` ADD CONSTRAINT `EventCustomFieldValue_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `EventCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventSongListDivider` ADD CONSTRAINT `EventSongListDivider_eventSongListId_fkey` FOREIGN KEY (`eventSongListId`) REFERENCES `EventSongList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefGroup` ADD CONSTRAINT `WorkflowDefGroup_workflowDefId_fkey` FOREIGN KEY (`workflowDefId`) REFERENCES `WorkflowDef`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNode` ADD CONSTRAINT `WorkflowDefNode_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `WorkflowDefGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNode` ADD CONSTRAINT `WorkflowDefNode_workflowDefId_fkey` FOREIGN KEY (`workflowDefId`) REFERENCES `WorkflowDef`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNodeDefaultAssignee` ADD CONSTRAINT `WorkflowDefNodeDefaultAssignee_nodeDefId_fkey` FOREIGN KEY (`nodeDefId`) REFERENCES `WorkflowDefNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNodeDefaultAssignee` ADD CONSTRAINT `WorkflowDefNodeDefaultAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNodeDependency` ADD CONSTRAINT `WorkflowDefNodeDependency_sourceNodeDefId_fkey` FOREIGN KEY (`sourceNodeDefId`) REFERENCES `WorkflowDefNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowDefNodeDependency` ADD CONSTRAINT `WorkflowDefNodeDependency_targetNodeDefId_fkey` FOREIGN KEY (`targetNodeDefId`) REFERENCES `WorkflowDefNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstance` ADD CONSTRAINT `WorkflowInstance_lastEvaluatedWorkflowDefId_fkey` FOREIGN KEY (`lastEvaluatedWorkflowDefId`) REFERENCES `WorkflowDef`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceLogItem` ADD CONSTRAINT `WorkflowInstanceLogItem_instanceId_fkey` FOREIGN KEY (`instanceId`) REFERENCES `WorkflowInstance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceLogItem` ADD CONSTRAINT `WorkflowInstanceLogItem_nodeDefId_fkey` FOREIGN KEY (`nodeDefId`) REFERENCES `WorkflowDefNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceLogItem` ADD CONSTRAINT `WorkflowInstanceLogItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNode` ADD CONSTRAINT `WorkflowInstanceNode_instanceId_fkey` FOREIGN KEY (`instanceId`) REFERENCES `WorkflowInstance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNode` ADD CONSTRAINT `WorkflowInstanceNode_nodeDefId_fkey` FOREIGN KEY (`nodeDefId`) REFERENCES `WorkflowDefNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNodeLastAssignee` ADD CONSTRAINT `WorkflowInstanceNodeLastAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNodeLastAssignee` ADD CONSTRAINT `WorkflowInstanceNodeLastAssignee_instanceNodeId_fkey` FOREIGN KEY (`instanceNodeId`) REFERENCES `WorkflowInstanceNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNodeAssignee` ADD CONSTRAINT `WorkflowInstanceNodeAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowInstanceNodeAssignee` ADD CONSTRAINT `WorkflowInstanceNodeAssignee_instanceNodeId_fkey` FOREIGN KEY (`instanceNodeId`) REFERENCES `WorkflowInstanceNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `MenuLink` RENAME INDEX `MenuLink_visiblePermissionId_fkey` TO `MenuLink_visiblePermissionId_idx`;

-- RenameIndex
ALTER TABLE `WikiPageRevision` RENAME INDEX `WikiPageRevision_wikiPageId_fkey` TO `WikiPageRevision_wikiPageId_idx`;
