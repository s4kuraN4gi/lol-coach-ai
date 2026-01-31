-- Add analysis_type column to video_analyses table
-- This column distinguishes between MICRO and MACRO analysis types

ALTER TABLE video_analyses
ADD COLUMN IF NOT EXISTS analysis_type TEXT;

-- Add index for faster queries by analysis_type
CREATE INDEX IF NOT EXISTS idx_video_analyses_analysis_type ON video_analyses(analysis_type);

-- Update existing records based on inputs.mode
UPDATE video_analyses
SET analysis_type = 'micro'
WHERE analysis_type IS NULL AND inputs->>'mode' = 'MICRO';

UPDATE video_analyses
SET analysis_type = 'macro'
WHERE analysis_type IS NULL AND inputs->>'mode' = 'MACRO';
