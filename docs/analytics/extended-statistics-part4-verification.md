# Расширенная статистика 16.8 — часть 4: использование Пути

Статус: COMPLETE

## Контракт

Экран показывает по двум историям Пути:

- `Начать понимать`: изучение слов — X людей · Y завершённых прохождений сетов; тесты — X людей · Y завершённых тестов.
- `Возвращение к истокам`: те же две метрики.

Учитываются только завершённые действия. Разделение выполняется только по техническим идентификаторам `story_id + dictionary_id + section_id + set_id`, а не по локализованным названиям.

`people` — уникальные люди за календарный месяц. `actions` — число завершённых прохождений; повторное завершение того же сета/теста считается отдельным завершённым действием.

## Источники

- Web authenticated learning: `learn_sessions`, только `status='completed'`.
- Web authenticated path tests: `station_test_sessions`, только `status='completed'`.
- Native и Web guest: `app_usage_events` через новый `record_path_usage_event`.
- Канонический набор допустимых ID: `content_words`, сведённый в уникальные tuple `story_id/dictionary_id/section_id/set_id`.

Для `station_test_sessions.group_id` используется роль `section_id`.

## Изменения

Миграция `20261007083000_alantil_16_8_extended_statistics_path_usage.sql`:

- добавляет в `app_usage_events` поля `dictionary_id`, `section_id`, `set_id`;
- добавляет `record_path_usage_event`, который принимает Path event только если полный tuple существует в `content_words`;
- `admin_extended_analytics` проверяет exact tuple для canonical Web sessions и supplementary Native/guest events;
- legacy Path events без полного tuple сохраняются в таблице, но не попадают в статистику;
- Ашыкъ и песни этой частью не изменяются.

Web и Native передают полный station context при завершении изучения и теста.

## Live verification

Миграция применена к Supabase `alantil-app` как `20261007032148_alantil_16_8_extended_statistics_path_usage`.

Сверка за октябрь 2026, ручной SQL против `admin_extended_analytics`:

| Метрика | Люди | Завершения | RPC = manual |
| --- | ---: | ---: | --- |
| understanding / learn | 6 | 10 | PASS |
| understanding / test | 6 | 24 | PASS |
| roots / learn | 3 | 4 | PASS |
| roots / test | 3 | 4 | PASS |

Дополнительно:

- duplicate path tuple между `understanding` и `roots`: 0;
- `record_path_usage_event` существует в live DB;
- direct SELECT/INSERT к `app_usage_events` для `anon` и `authenticated`: запрещены;
- RPC доступен `anon` и `authenticated` намеренно, потому что guest/native analytics должны записываться без прямого доступа к таблице;
- advisor-предупреждения для SECURITY DEFINER RPC и RLS-without-policy являются следствием этой существующей write-through-RPC модели; новых прямых table grants не добавлено.

## Verification CI

На implementation HEAD `db2727531d0f52c2f236ebe8a78b8f01097a15fc`:

- `QA social and community` — PASS;
- `Run final repository QA` — PASS;
- `Browser verification` — FAIL только на ранее существующем `scripts/qa/browser-ashyk.cjs:222`, `11 !== 12`; этот же дефект существовал до части 4 и не связан с Path usage.
