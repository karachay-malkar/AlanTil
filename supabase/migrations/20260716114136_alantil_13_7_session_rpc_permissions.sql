-- Tighten the existing table grants after all session writes moved to RPCs.

begin;

revoke all on public.learn_sessions from authenticated;
revoke all on public.learn_session_words from authenticated;
revoke all on public.test_sessions from authenticated;
revoke all on public.test_session_words from authenticated;
revoke all on public.station_test_sessions from authenticated;
revoke all on public.station_test_session_words from authenticated;
revoke all on public.match_sessions from authenticated;
revoke all on public.match_session_words from authenticated;
revoke all on public.match_session_errors from authenticated;
revoke all on public.user_word_progress from authenticated;

grant select on public.learn_sessions to authenticated;
grant select on public.learn_session_words to authenticated;
grant select on public.test_sessions to authenticated;
grant select on public.test_session_words to authenticated;
grant select on public.station_test_sessions to authenticated;
grant select on public.station_test_session_words to authenticated;
grant select on public.match_sessions to authenticated;
grant select on public.match_session_words to authenticated;
grant select on public.match_session_errors to authenticated;
grant select on public.user_word_progress to authenticated;

commit;
