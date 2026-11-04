-- AlanTil 17.2.70: public RPC should run with the authenticated caller's privileges.
-- The private mutation retains SECURITY DEFINER and enforces auth.uid(), ownership,
-- revision checks and operation receipts. Private schema is not exposed via PostgREST.
GRANT EXECUTE ON FUNCTION private.remove_tower_v3_sections(bigint,uuid,uuid[]) TO authenticated;
ALTER FUNCTION public.remove_tower_v3_sections(bigint,uuid,uuid[]) SECURITY INVOKER;
