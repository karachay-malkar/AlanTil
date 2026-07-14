# AlanTil 12.2 — настройка Supabase Auth

## 1. Создание таблиц и политик

1. Откройте Supabase Dashboard.
2. Перейдите в **SQL Editor**.
3. Откройте файл `supabase/schema.sql` из проекта.
4. Выполните файл целиком.

Скрипт создаёт:

- `profiles` — уникальный никнейм без email;
- Row Level Security для профиля;
- функцию проверки доступности никнейма;
- `blocked_emails` — список запрещённых адресов;
- Auth Hook, который запрещает создание нового аккаунта для адреса из списка.

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
- Callback URL Supabase добавлен в Google Cloud OAuth Client.

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

Строка `profiles` удалится автоматически по `on delete cascade`.

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
4. Обновите страницу — сессия должна сохраниться.
5. Выполните выход.
6. Проверьте вход по email.
7. Добавьте тестовый email в `blocked_emails` и убедитесь, что новый аккаунт с ним создать нельзя.

## Безопасность

В браузере используется только публичный Supabase Publishable Key.

Запрещено добавлять в проект:

- Google Client Secret;
- Supabase Secret Key;
- Supabase `service_role` key.

Удаление и блокировка пользователей выполняются в Supabase Dashboard. Административные ключи в AlanTil не используются.
