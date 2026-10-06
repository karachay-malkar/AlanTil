# Расширенная статистика 16.8 — часть 1: карта данных

## Граница аудита

Аудит выполнен по ветке `agent/16.8.0` от исходного HEAD `cdf84ea52fcf6c2770af31d27a0923eb0cc17bd8`.
Интерфейс, роутинг и navigation handlers в этой части не меняются. Цель — определить канонические источники и исключить двойную запись одного завершённого действия.

## Идентификация посетителя

### Web

- Авторизованный пользователь: `getCurrentAuthState().user.id` / Supabase `auth.uid()`.
- Стабильный guest visitor id: localStorage `alantil_analytics_visitor_id_v1`.
- Visit session id: localStorage `alantil_analytics_session_v1`, таймаут 30 минут.
- Запись посещения: `record_anonymous_visit_v2` → `public.anonymous_visit_sessions`.
- При переходе guest → account visitor id сохраняется. Первый authenticated visit с тем же visitor id записывает `user_id` в visit session. Для восстановленной сессии это дополнительно вызывается через `linkRestoredAccountVisit()`; OAuth callback и обычная навигация записывают authenticated page view после инициализации auth.
- `resolveAnonymousIdentity()` допускает переиспользование текущей guest session после появления user scope, поэтому связь не требует нового visitor id.

### Native

- Авторизованный пользователь: `getNativeAuthSession().user.id`; `nativeAuthFetch()` передаёт access token, а RPC получает `auth.uid()`.
- Стабильный guest visitor id: AsyncStorage `alantil:analytics:visitor-id`.
- Visit session id хранится в runtime процесса приложения.
- `record_anonymous_visit_v2` использует тот же visitor id до и после входа, поэтому последующие native visits связывают visitor с `user_id`.

## Канонические источники

| Показатель / область | Канонический источник | Ключи завершения | Решение |
| --- | --- | --- | --- |
| Посещения Web + Native | `anonymous_visit_sessions` | `visitor_id`, `user_id`, `first_seen_at`, `last_seen_at` | Единственный источник посещаемости. |
| Web: изучение слов | `learn_sessions` | `status='completed'`, `user_id`, `dictionary_id`, `section_id`, `set_id`, `ended_at` | Использовать напрямую; не копировать authenticated Web completion в event table. |
| Web: слова внутри изучения | `learn_session_words` | `session_id`, `word_id` | Детализация, не отдельный факт завершения сета. |
| Агрегат состояния сета | `user_set_progress` | `completed_total`, `last_completed_at` | Использовать для состояния пользователя, не как журнал событий по датам. |
| Web: тест станции | `station_test_sessions` | `status='completed'`, `story_type`, `dictionary_id`, `group_id`, `set_id`, `ended_at` | Использовать напрямую. |
| Агрегат станции | `user_station_progress` | `test_attempts_total`, `first_test_completed_at`, review timestamps | Состояние/прогресс, не журнал всех завершений. |
| Общие тесты | `test_sessions`, `test_session_words` | `status` + session id | Не использовать для статистики Пути: это другой режим тестирования. |
| Matching | `match_sessions`, `match_session_words`, `match_session_errors` | `status` + session id | Не относится к текущему блоку использования разделов. |
| Сводный word progress | `user_word_progress` | counters + timestamps | Агрегат; не использовать как замену session history. |
| Онлайн-Ашыкъ | `ashyk_rooms` | room `id`, `status`, `host_user_id`, `guest_user_id`, `ended_at`, `finish_reason` | Единственный журнал онлайн-партий. `app_usage_events.ashyk_online_complete` больше не нужен. |
| Компьютер-Ашыкъ | `app_usage_events` | `event_type='ashyk_computer_complete'` | Собственной server-side game table нет, поэтому это минимальный analytics event. |
| Контент песен | `songs`, `song_lines` | song id | Это контент, не история использования. |
| Открытие конкретного текста | `app_usage_events` | `event_type='song_lyrics_open'`, `item_key=song id` | Отдельного доменного журнала нет; минимальный analytics event оправдан. |

## Web / Native различие для Пути

Web после завершения создаёт durable progress entry и через `save_learn_session` / `save_station_test_session` сохраняет полную session history в Supabase.

Native в текущей архитектуре сохраняет локальную session/history, но cloud sync отправляет `word_progress_snapshot`, избранное и настройки; `learn_sessions` / `station_test_sessions` из Native в Supabase не создаются.

Поэтому `app_usage_events` для `path_learn_complete` и `path_test_complete` остаётся только как дополнительный источник для:

1. Native — guest и authenticated;
2. Web guest — пока guest session ещё не перенесена в аккаунт.

Authenticated Web completion не записывается в `app_usage_events`. Если guest Web session позднее была claim-нута и появилась в canonical session table с тем же session id, analytics query исключает соответствующий event по `item_key`.

## Что удалено как дублирование

Миграция части 1:

- удаляет triggers `learn_sessions_capture_usage`, `station_test_sessions_capture_usage`, `ashyk_rooms_capture_usage`;
- удаляет trigger functions, которые копировали canonical rows в `app_usage_events`;
- удаляет исторические authenticated Web path-event копии;
- удаляет все `ashyk_online_complete` event copies;
- запрещает новые `ashyk_online_complete` события;
- оставляет `app_usage_events` только как supplementary event ledger там, где canonical domain row отсутствует.

## Источник для admin_extended_analytics

`admin_extended_analytics` строит использование из объединения:

- `learn_sessions` — Web authenticated learning;
- `station_test_sessions` — Web authenticated path tests;
- `ashyk_rooms` — online games;
- `app_usage_events` — Native/guest path completions, computer games, song lyric opens.

Посещаемость и person identity продолжают строиться только через `anonymous_visit_sessions`.

## Текущие Supabase RPC / запросы, относящиеся к этой карте

- `record_anonymous_visit_v2` — посещения и guest/account identity binding.
- `save_learn_session` — Web learning session history.
- `save_station_test_session` — Web station test history.
- `merge_word_progress_snapshot` — агрегированный Native/Web word progress.
- `record_app_usage_event` — только supplementary product events по правилам выше.
- `admin_extended_analytics` — read model для экрана расширенной статистики.
- Ashyk RPC family (`ashyk_room_*`, `ashyk_submit_action`, `ashyk_leave_room`) — состояние `ashyk_rooms`.

## Навигация и системный chrome

- Верхняя/нижняя системная навигация: `src/app/shell.js`, `src/shared/styles/shell.css`, `src/shared/styles/chrome.css`.
- Маршрут расширенной статистики остаётся `friends.home { mode: 'stats' }` / `/friends/statistics`.
- Текущие router navigation handlers не изменяются в части 1.
- UI `src/features/admin/index.js` и `src/features/admin/admin.css` этой частью не меняются.

## Итоговое архитектурное правило

Один факт завершения должен иметь один канонический источник. Event table не копирует server-side domain rows. Она используется только там, где доменного журнала нет или где платформа ещё не сохраняет session history в Supabase.
