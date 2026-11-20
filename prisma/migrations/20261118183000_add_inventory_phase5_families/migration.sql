-- Phase 5 only adds classifications for future records.
-- Existing Element rows and their relationships are intentionally untouched.
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'electricalEquipment';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'tools';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'ladders';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'materials';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'electricalHarness';
