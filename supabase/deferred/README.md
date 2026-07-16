# Deferred Supabase cleanup

Files in this directory are deliberately excluded from automatic migration runs.

`20260717_alantil_13_7_cleanup_legacy_dictionary_progress.sql` may be moved into
`supabase/migrations/` and applied only after the deployed 13.7 client has been
verified to load all words exclusively from `v_words_app` and to use only the
canonical progress counters. Until then, `content_words_ru` and the five legacy
counters must remain available to the deployed 13.6 client.
