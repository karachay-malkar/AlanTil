# Расширенная статистика 16.8 — часть 5: Ашыкъ оюн и песни

Статус: COMPLETE

## Контракт

### Ашыкъ оюн — с компьютером
- UI: `X людей · Y игр`.
- Считаются только партии, завершённые естественным игровым условием.
- Выход/сдача (`resign`), открытие игры и незавершённая сессия не считаются.
- Web и Native записывают `ashyk_computer_complete` только для natural finish и передают `item_key='score'|'kyt'`.
- RPC отклоняет computer-complete без такого marker.

### Ашыкъ оюн — онлайн
- Канонический источник: `ashyk_rooms`.
- Считаются только `status='finished'` и `finish_reason in ('score','kyt')`.
- `resign`, `disconnect` и `abandoned` не считаются.
- `Y` — distinct room id, `X` — distinct participants.
- Комната должна иметь второго участника (`guest_user_id is not null`).

### Песни
- UI: `X людей · Y открытий`.
- Web пишет событие только если конкретный Song View реально отрисовал lyrics.
- Native пишет событие только если Song Detail построил непустую lyrics model.
- Сервер дополнительно принимает/учитывает `song_lyrics_open` только для опубликованной песни, имеющей строки в `song_lines`.

## Реализация

- `packages/ashyk-game/leave.js`: единый predicate `isNaturalAshykComputerCompletion`.
- `src/features/ashyk/index.js`: Web computer completion использует predicate и marker `score/kyt`.
- `mobile/screens/ashyk.js`: тот же контракт на Native.
- `supabase/migrations/20261007090000_alantil_16_8_extended_statistics_ashyk_songs.sql`: серверная валидация событий и фильтрация read-model.
- `tests/extended-statistics-16-8.test.mjs`: regression contract Part 5.

Миграция намеренно имеет timestamp позже Part 4 (`20261007083000`), чтобы чистый deploy не перезаписал Part 5 старой версией `admin_extended_analytics`.

## Live verification

Supabase: `alantil-app`.

Финальная live registration: `20261007045511_alantil_16_8_extended_statistics_ashyk_songs_ordered`.

Ручная сверка исходных строк против `admin_extended_analytics(0)`:

| Месяц | Метрика | Люди | Действия |
| --- | --- | ---: | ---: |
| 2026-09 | Ашыкъ онлайн | 2 | 1 |
| 2026-10 | Ашыкъ с компьютером | 0 | 0 |
| 2026-10 | Тексты песен | 5 | 30 |

В live `ashyk_rooms` сейчас 13 finished rooms:
- 1 `score` — учитывается;
- 11 `resign` — исключены;
- 1 `disconnect` — исключена.

Natural online rooms: 1. Excluded finished rooms: 12.
Computer completion events: 0, поэтому корректный live результат сейчас 0/0.
Все 30 существующих lyric-open событий относятся к опубликованным песням с реальными `song_lines`; invalid lyric events: 0.

## Verification

TDD:
- RED: Part 5 regression отсутствующая migration.
- GREEN: implementation прошёл `QA social and community`.
- RED refactor: regression потребовал shared predicate в lightweight module.
- GREEN: predicate перенесён в `leave.js`, без отдельной загрузки `store.js` Web feature.

Известный общий Browser QA дефект вне Part 5: `scripts/qa/browser-ashyk.cjs:222`, `11 !== 12`; тот же дефект существовал до изменений статистики.
