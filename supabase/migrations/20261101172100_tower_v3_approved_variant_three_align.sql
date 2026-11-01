ALTER TABLE private.tower_v3_sections DROP CONSTRAINT tower_v3_approved_variant_check;
ALTER TABLE private.tower_v3_sections ADD CONSTRAINT tower_v3_approved_variant_check
 CHECK (geometry_version<>'17.7-approved-manual.1' OR
   (section_id='1x1x1' AND variant_id BETWEEN 0 AND 2) OR
   (section_id='2x2x2' AND variant_id BETWEEN 0 AND 2) OR
   (section_id='2x3x4' AND variant_id BETWEEN 0 AND 2) OR
   (section_id='3x3x3' AND variant_id BETWEEN 0 AND 1));
