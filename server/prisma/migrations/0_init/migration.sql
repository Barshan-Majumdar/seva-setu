-- SevaSetu: Initial migration
-- This migration is designed to be run with `prisma migrate resolve` after
-- the Prisma schema creates the base tables, to add PostGIS columns & indexes.

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add PostGIS geometry columns (Prisma cannot model these natively)
-- These are idempotent: they check if column exists before adding.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'volunteers' AND column_name = 'location'
  ) THEN
    PERFORM AddGeometryColumn('volunteers', 'location', 4326, 'POINT', 2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'needs' AND column_name = 'location'
  ) THEN
    PERFORM AddGeometryColumn('needs', 'location', 4326, 'POINT', 2);
  END IF;
END $$;

-- Create GIST spatial indexes
CREATE INDEX IF NOT EXISTS idx_volunteers_location ON volunteers USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_needs_location ON needs USING GIST(location);
