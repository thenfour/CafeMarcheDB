/*
  Warnings:

  - You are about to drop the `instrumenttag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `instrumenttagassociation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `instrumenttagassociation` DROP FOREIGN KEY `InstrumentTagAssociation_instrumentId_fkey`;

-- DropForeignKey
ALTER TABLE `instrumenttagassociation` DROP FOREIGN KEY `InstrumentTagAssociation_tagId_fkey`;

-- DropTable
DROP TABLE `instrumenttag`;

-- DropTable
DROP TABLE `instrumenttagassociation`;
