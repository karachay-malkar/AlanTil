create index if not exists user_hidden_words_word_idx on public.user_hidden_words(word_id);
create index if not exists user_word_favorites_word_idx on public.user_word_favorites(word_id);
create index if not exists user_word_progress_word_idx on public.user_word_progress(word_id);
