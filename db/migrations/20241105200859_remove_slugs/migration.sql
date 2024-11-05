/*
  Warnings:

  - You are about to drop the column `slug` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `instrument` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `song` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Event_slug_idx` ON `Event`;

-- DropIndex
DROP INDEX `Instrument_slug_idx` ON `Instrument`;

-- DropIndex
DROP INDEX `Song_slug_idx` ON `Song`;

-- AlterTable
ALTER TABLE `Event` DROP COLUMN `slug`;

-- AlterTable
ALTER TABLE `Instrument` DROP COLUMN `slug`;

-- AlterTable
ALTER TABLE `Song` DROP COLUMN `slug`;
