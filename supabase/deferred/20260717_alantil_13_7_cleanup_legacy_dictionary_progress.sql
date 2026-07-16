-- AlanTil 13.7 post-deployment cleanup.
--
-- DO NOT apply this migration while any deployed client still uses
-- content_words_ru or the legacy counters.  Apply it only after the 13.7 client
-- has been verified against v_words_app in production.

begin;

drop view if exists public.content_words_ru;

alter table public.user_word_progress
  drop column if exists learn_shows_total,
  drop column if exists learn_known_total,
  drop column if exists learn_left_swipes_total,
  drop column if exists test_correct_total,
  drop column if exists test_wrong_total;

notify pgrst, 'reload schema';

commit;
