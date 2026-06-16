-- Add use_multiplier to scoring_rules table
ALTER TABLE scoring_rules ADD COLUMN use_multiplier BOOLEAN NOT NULL DEFAULT false;
