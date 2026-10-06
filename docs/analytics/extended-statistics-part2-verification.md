# Расширенная статистика 16.8 — часть 2: базовая посещаемость

Статус: COMPLETE

## Реализованный контракт

- График: «Посетители по дням».
- Один человек учитывается не более одного раза за календарный UTC-день.
- Авторизованный пользователь идентифицируется по `user_id`.
- Гость идентифицируется по стабильному `visitor_id`.
- Guest → account связывается через историю `anonymous_visit_sessions`; при однозначной связи visitor с аккаунтом guest-посещения получают тот же person key.
- Если один browser visitor использовался несколькими аккаунтами, глобальное связывание намеренно не применяется; используется более консервативная day-level связь.
- Источник посещаемости: только `anonymous_visit_sessions`.
- Старые показатели sessions / pageviews / pages per session / new-returning / traffic-source breakdown в новом экране не используются.
- Tooltip: `6 октября — 57 человек`.
- Date-only значения форматируются в UTC, чтобы локальный timezone устройства не сдвигал календарный день.

## Live DB verification

Проект: `alantil-app`.

Проверка `2026-10-01`:

- исходных строк `anonymous_visit_sessions`, пересекающих календарный день: 62;
- уникальных `visitor_id`: 50;
- после объединения guest / authenticated identity: 44 уникальных человека;
- людей с несколькими session-row в этот день: 8;
- максимум session-row у одного человека: 12;
- `admin_extended_analytics(30).daily_visitors[2026-10-01]`: 44.

Проверка `2026-10-06`:

- `admin_extended_analytics(30).daily_visitors`: 28 человек.

Таким образом UI/RPC-модель считает людей, а не сессии или просмотры.

## Точки реализации

- `src/features/admin/index.js` — daily chart и tooltip.
- `packages/alantil-core/social-i18n.js` — полный label «человек».
- `supabase/migrations/20261006172000_alantil_16_8_extended_statistics_source_map.sql` — объединённая person identity и `count(distinct person_key)`.
- `src/shared/analytics/visitor-analytics.js` — стабильный Web visitor id и запись visits.
- `mobile/platform/analytics.js` — стабильный Native visitor id и запись visits.
- `tests/extended-statistics-16-8.test.mjs` — regression contract части 2.

## Не относится к части 2

Месячная регулярность и использование разделов не изменялись в рамках этой части; они проверяются отдельно в частях 3–5.
