-- Migration: Add custom theme color to participants
ALTER TABLE participants ADD COLUMN IF NOT EXISTS color VARCHAR(30);
COMMENT ON COLUMN participants.color IS 'Color hexadecimal personalizado para la tarjeta del participante';
