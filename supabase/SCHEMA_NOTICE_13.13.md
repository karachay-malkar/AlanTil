# Supabase schema source — 13.13

`supabase/schema.sql` is a legacy 13.7 bootstrap snapshot and is not the authoritative schema for 13.13.

For 13.13 and later, the authoritative database schema is the ordered migration history in `supabase/migrations/`.

The restored content hierarchy `Story → Dictionary → Section → Set → Word` is introduced by:

- `20260808230307_restore_content_hierarchy.sql`
- `20260808232213_restrict_content_structure_grants.sql`

Do not use `schema.sql` to replace or recreate the current 13.13 schema.
