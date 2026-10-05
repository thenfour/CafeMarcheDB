/*
  Warnings:

  - You are about to drop the `InstrumentTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InstrumentTagAssociation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `InstrumentTagAssociation` DROP FOREIGN KEY `InstrumentTagAssociation_instrumentId_fkey`;

-- DropForeignKey
ALTER TABLE `InstrumentTagAssociation` DROP FOREIGN KEY `InstrumentTagAssociation_tagId_fkey`;

-- DropTable
DROP TABLE `InstrumentTag`;

-- DropTable
DROP TABLE `InstrumentTagAssociation`;
