/*
  Warnings:

  - You are about to drop the column `workflowDefId` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstanceId` on the `event` table. All the data in the column will be lost.
  - You are about to drop the `eventcustomfield` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `eventcustomfieldvalue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowdef` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowdefgroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowdefnode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowdefnodedefaultassignee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowdefnodedependency` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowinstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowinstancelogitem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowinstancenode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowinstancenodeassignee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflowinstancenodelastassignee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Event` DROP FOREIGN KEY `Event_workflowDefId_fkey`;

-- DropForeignKey
ALTER TABLE `Event` DROP FOREIGN KEY `Event_workflowInstanceId_fkey`;

-- DropForeignKey
ALTER TABLE `EventCustomFieldValue` DROP FOREIGN KEY `EventCustomFieldValue_customFieldId_fkey`;

-- DropForeignKey
ALTER TABLE `EventCustomFieldValue` DROP FOREIGN KEY `EventCustomFieldValue_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefGroup` DROP FOREIGN KEY `WorkflowDefGroup_workflowDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNode` DROP FOREIGN KEY `WorkflowDefNode_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNode` DROP FOREIGN KEY `WorkflowDefNode_workflowDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNodeDefaultAssignee` DROP FOREIGN KEY `WorkflowDefNodeDefaultAssignee_nodeDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNodeDefaultAssignee` DROP FOREIGN KEY `WorkflowDefNodeDefaultAssignee_userId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNodeDependency` DROP FOREIGN KEY `WorkflowDefNodeDependency_sourceNodeDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowDefNodeDependency` DROP FOREIGN KEY `WorkflowDefNodeDependency_targetNodeDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstance` DROP FOREIGN KEY `WorkflowInstance_lastEvaluatedWorkflowDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceLogItem` DROP FOREIGN KEY `WorkflowInstanceLogItem_instanceId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceLogItem` DROP FOREIGN KEY `WorkflowInstanceLogItem_nodeDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceLogItem` DROP FOREIGN KEY `WorkflowInstanceLogItem_userId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNode` DROP FOREIGN KEY `WorkflowInstanceNode_instanceId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNode` DROP FOREIGN KEY `WorkflowInstanceNode_nodeDefId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNodeAssignee` DROP FOREIGN KEY `WorkflowInstanceNodeAssignee_instanceNodeId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNodeAssignee` DROP FOREIGN KEY `WorkflowInstanceNodeAssignee_userId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNodeLastAssignee` DROP FOREIGN KEY `WorkflowInstanceNodeLastAssignee_instanceNodeId_fkey`;

-- DropForeignKey
ALTER TABLE `WorkflowInstanceNodeLastAssignee` DROP FOREIGN KEY `WorkflowInstanceNodeLastAssignee_userId_fkey`;

-- AlterTable
ALTER TABLE `Event` DROP COLUMN `workflowDefId`,
    DROP COLUMN `workflowInstanceId`;

-- DropTable
DROP TABLE `EventCustomField`;

-- DropTable
DROP TABLE `EventCustomFieldValue`;

-- DropTable
DROP TABLE `WorkflowDef`;

-- DropTable
DROP TABLE `WorkflowDefGroup`;

-- DropTable
DROP TABLE `WorkflowDefNode`;

-- DropTable
DROP TABLE `WorkflowDefNodeDefaultAssignee`;

-- DropTable
DROP TABLE `WorkflowDefNodeDependency`;

-- DropTable
DROP TABLE `WorkflowInstance`;

-- DropTable
DROP TABLE `WorkflowInstanceLogItem`;

-- DropTable
DROP TABLE `WorkflowInstanceNode`;

-- DropTable
DROP TABLE `WorkflowInstanceNodeAssignee`;

-- DropTable
DROP TABLE `WorkflowInstanceNodeLastAssignee`;
