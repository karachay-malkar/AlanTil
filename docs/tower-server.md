# Tower server v1

Migration: `20261011100000_alantil_tower_game.sql`. Target verified read-only: alantil-app `pybrzgedqjmosbmilcea`. Additive migration applied after parent review; verification below.

## API

Authenticated `get_tower_snapshot({p_user_id:null})` lazily creates account, credits historical/new saved results and returns `{revision,silver,gold,elements,reward_mapping_version:1}`. Supplying another user UUID returns only their geometry/revision with null balances. Anonymous access is denied.

`mutate_tower({p_revision,p_operation_id,p_action,p_element,p_element_id,p_currency})`. `p_action`: `place`, `remove`, `exchange_gold` (one gold to eight silver), `exchange_silver` (eight silver to one gold). Unused optional fields null; currency defaults silver.

Place body `{id,type,x,y,z,sx,sy,sz,rotation,variant}`. All coordinates/extents integer grid cells. Bounds x/z 0..59, y 0..79. Rotation 0..3 yaw; beam 4/5 vertical. Dimensions are canonical local extents; server transforms into world bounding boxes using rotation. Types `stone,medium,long,big,beam,deck,window,door,ladder,roof`. Prices silver 1/4/8/24/8/16/24/32/64/160. Door price32, ladder dimensions 3×8..16×1..4, roof 4..40×2..8×4..40 and height ceiling80 are implementation proposals, not historical measurements. Gold only for prices divisible by8; exchange handles smaller pieces.

Snapshot compact array `[id,type,x,y,z,sx,sy,sz,rotation,variant,currency,paid]`. Immutable paid fields ensure exact original-currency refund. TOAST JSONB snapshot, no per-player meshes/textures. 10,000 element cap. Transactions lock one account; operation UUID receipt prevents duplicate spends/refunds/exchanges. Identical retry returns current account snapshot with replayed:true and never repeats mutation. Reusing UUID with different request raises OPERATION_ID_REUSED. REVISION_CONFLICT requires refresh and a NEW operation UUID for a revised request. Failed transaction persists neither receipt nor spend.

Geometry rejects out of bounds, overlapping boxes, unsupported pieces. Stones and opening modules require full bottom support. Horizontal long stone/beam/deck require support under both opposite ends. Remove revalidates remaining geometry; dependent pieces must first be removed individually. Roof support is simplified; ladder requires full bottom support. Rules are constructive game checks, not engineering simulation. Opening module bounding boxes remain reserved even though mesh may contain empty interior; no overlapping stone across the opening.

## Rewards and security

Each distinct word rewarded once, from a correct word row joined to a completed test or station-test session. Whole-test accuracy is irrelevant. Mapping v1: intermediate/advanced gold; beginner/thematic/other silver. Current content_words is authoritative, no client word list/mint amounts accepted. Unique `(user_id,word_id)` prevents replay and overlapping test/station grants. Historical rows use same rule. Missing detailed historic rows cannot be reconstructed from aggregate accuracy and earn nothing automatically.

Existing test APIs accept client-reported results: this trust is inherited. Tower prevents direct wallet modification and invented tower mint requests, but does not introduce server-graded educational tests. Strong anti-cheat requires changing the existing test protocol. Snapshot reward refresh changes balance without geometric revision; clients must trust returned balance and handle INSUFFICIENT_FUNDS.

Private tables have RLS and no authenticated table privileges. Public SECURITY INVOKER wrappers call ownership-checking private SECURITY DEFINER functions with empty search_path. Helper functions revoked from public/anon; only entry points granted authenticated. No caller-provided user owner in mutations. Read-only viewers never get wallet or reward receipts.

Operation receipts retain compact response metadata, without geometry snapshots. Their request stores at most one placed element. Before large rollout introduce receipt expiry with a documented retry window. Reward ledger requires one small row per acquired word, not one per test answer.

## Verification (2026-10-11)

Applied additive migration through Supabase apply_migration after parent review. SQL statements parsed with pglast; all four PL/pgSQL function bodies parsed after substituting public for private namespace only for parser's restricted catalog lookup (source unchanged).

Executed a real PostgreSQL `BEGIN; DO ...; ROLLBACK` fixture using one existing auth UUID with transaction-local JWT sub, temporarily reset account funds and empty geometry inside the rolled-back transaction. Verified place, identical request replay, changed-payload operation-ID rejection, stale-revision rejection, dependent-removal rejection, remove/refund flow, vertical rotated beam geometry, unsupported floating stone rejection, and AUTH_REQUIRED with no JWT sub. All assertions completed. No fixture account/reward/receipt changes persisted. Permission query separately checks anonymous RPC denied, authenticated RPC allowed and direct wallet update denied.

## Incremental geometry follow-up

`20261011110000_alantil_tower_incremental_geometry.sql` preserves the original applied migration and replaces only tower mutation geometry calls. Placement validates bounds/collisions/support of the new piece against the existing valid snapshot. Deletion checks support only for pieces whose bottom intersects the removed piece's top. Removal cannot create collisions or change unrelated supports, so full pair checks are unnecessary. All helper functions are private and revoked from public/anon/authenticated; callers reach them only through the existing definer mutation. The full-snapshot validator remains available for administrative integrity checks.

Existing snapshot validity is an invariant of RPC-only writes. A service-role/manual geometry edit must be validated with `private.tower_geometry_valid` before persisting. Support candidate filtering happens once per changed element; cell coverage then scans only nearby eligible supports. World-rotation transformation remains linear in snapshot size. Supported-piece removal may check several direct dependents, but no all-pairs snapshot collision pass runs.

Applied follow-up to verified project and executed a rollback assertion/benchmark fixture with 1,000 non-overlapping ground stones. Full validation of one added stone took **1308.928 ms**; incremental placement took **22.059 ms** (about 59× faster on this one fixture; timing is not a device/server guarantee). Assertions passed collision, unsupported/top-supported placement, dependent-removal rejection, empty removal, rotated beam, actual RPC spend, replay without duplicate spend, and exact refund. All fixture changes rolled back.
