/*
  Warnings:

  - You are about to drop the column `slug` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `instrument` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `song` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Event_slug_idx` ON `event`;

-- DropIndex
DROP INDEX `Instrument_slug_idx` ON `instrument`;

-- DropIndex
DROP INDEX `Song_slug_idx` ON `song`;

-- AlterTable
ALTER TABLE `event` DROP COLUMN `slug`;

-- AlterTable
ALTER TABLE `instrument` DROP COLUMN `slug`;

-- AlterTable
ALTER TABLE `song` DROP COLUMN `slug`;
