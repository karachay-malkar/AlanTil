# AlanTil 13.6.1 — настройка Supabase Auth и словаря

## 1. Создание таблиц и политик

1. Откройте Supabase Dashboard.
2. Перейдите в **SQL Editor**.
3. Откройте файл `supabase/schema.sql` из проекта.
4. Выполните файл целиком.
5. После загрузки нормализованных таблиц `content_*` выполните
   `supabase/migrations/13.6.1_dictionary_view_path_progress.sql`.
6. Дождитесь успешного выполнения и обновления кэша схемы PostgREST.

Скрипт создаёт:

- `profiles` и проверку уникального никнейма;
- неизменяемый после первого выбора `profiles.avatar_gender`;
- публично читаемую версию словаря в `dictionary_metadata`;
- `user_settings`;
- облачные состояния избранного, скрытых слов и прогресса сетов;
- общие таблицы сессий `learn_sessions`, `test_sessions`, `match_sessions`;
- детализацию слов и ошибочных сопоставлений;
- накопительную таблицу `user_word_progress`;
- атомарные функции `save_learn_session`, `save_test_session`, `save_match_session`;
- совместимое представление словаря `content_words_ru`;
- прогресс станций, тестов пути, наград и настроек маршрута;
- Row Level Security: пользователь видит только собственные данные;
- `blocked_emails` и Auth Hook для запрета новых аккаунтов.

## 2. URL авторизации

Откройте **Authentication → URL Configuration**.

Site URL:

```text
https://alantil.ru
```

Redirect URLs:

```text
https://alantil.ru/account
https://alantil.ru/account/
http://localhost:5173/account
http://localhost:3000/account
```

## 3. Провайдеры

### Google

Откройте **Authentication → Providers → Google** и проверьте:

- Google включён;
- Client ID заполнен;
- Client Secret заполнен;
- Callback URL Supabase добавлен в Google Cloud OAuth Client:

```text
https://pybrzgedqjmosbmilcea.supabase.co/auth/v1/callback
```

В Google Cloud не нужно добавлять `https://alantil.ru/account`: этот адрес используется Supabase только как URL возврата в приложение.

Client Secret нельзя добавлять в GitHub или клиентский код.

### Email

Откройте **Authentication → Providers → Email** и оставьте Email Provider включённым.
Приложение вызывает Magic Link/OTP через `signInWithOtp`, пароль пользователю не нужен.

## 4. Включение постоянной блокировки email

После выполнения `schema.sql` откройте:

**Authentication → Hooks → Before User Created**

Выберите Postgres Function:

```text
public.hook_reject_blocked_email
```

Включите Hook и сохраните.

Без этого шага таблица `blocked_emails` существует, но не участвует в регистрации.

## 5. Управление пользователями

### Временно или бессрочно заблокировать существующего пользователя

1. Откройте **Authentication → Users**.
2. Найдите пользователя по email.
3. Откройте пользователя.
4. Выберите **Ban user** и срок блокировки.

Блокировка пользователя запрещает ему вход, но не удаляет профиль и историю.

### Удалить аккаунт

1. Откройте **Authentication → Users**.
2. Найдите пользователя.
3. Выберите **Delete user**.

Профиль, настройки, прогресс и история сессий удалятся автоматически по `on delete cascade`.

### Заблокировать email навсегда, включая повторную регистрацию

Сначала добавьте email в `blocked_emails`, затем заблокируйте или удалите существующего пользователя.

В SQL Editor:

```sql
insert into public.blocked_emails (email, reason)
values ('example@gmail.com', 'Blocked by administrator')
on conflict (email) do update set reason = excluded.reason;
```

Auth Hook запрещает создание нового аккаунта через Google и Email с этим адресом.
Для уже существующего аккаунта дополнительно нужен **Ban user**, потому что Before User Created Hook запускается только при создании нового пользователя.

### Полностью разблокировать

1. Снимите Ban в **Authentication → Users**, если пользователь существует.
2. Удалите email из списка:

```sql
delete from public.blocked_emails
where email = 'example@gmail.com';
```

## 6. Проверка

1. Откройте `/account`.
2. Выполните вход через Google.
3. Создайте уникальный никнейм.
4. Выберите пол аватара и подтвердите выбор.
5. Убедитесь, что повторно изменить `avatar_gender` нельзя.
6. Обновите страницу — сессия и выбранный аватар должны сохраниться.
7. Выполните выход.
8. Проверьте вход по email.
9. Добавьте слово в избранное, завершите короткую сессию и проверьте появление строк в таблицах прогресса.
10. Повторно отправленная сессия с тем же UUID не должна увеличивать статистику второй раз.
11. Добавьте тестовый email в `blocked_emails` и убедитесь, что новый аккаунт с ним создать нельзя.

## Версия словаря

После публикации новой таблицы обновите только значение версии:

```sql
update public.dictionary_metadata
set current_version = 'ДД.ММ.ГГГГ'
where dictionary_key = 'main';
```

Версию нужно менять после успешного обновления `content_words_ru`. Приложение сравнивает её с версией локального словаря пользователя.

Проверка объектов базы:

```sql
select to_regclass('public.learn_sessions');
select to_regclass('public.test_sessions');
select to_regclass('public.match_sessions');
select to_regclass('public.user_word_progress');
select to_regclass('public.content_words_ru');
select to_regclass('public.user_station_progress');
select to_regclass('public.station_test_sessions');
select to_regprocedure('public.save_learn_session(jsonb)');
select to_regprocedure('public.save_test_session(jsonb)');
select to_regprocedure('public.save_match_session(jsonb)');
```

## Безопасность

В браузере используется только публичный Supabase Publishable Key.

Запрещено добавлять в проект:

- Google Client Secret;
- Supabase Secret Key;
- Supabase `service_role` key.

Удаление и блокировка пользователей выполняются в Supabase Dashboard. Административные ключи в AlanTil не используются.
