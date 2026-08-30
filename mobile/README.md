# Алан тил Mobile 14.1

Полноценный мобильный клиент на React Native + Expo. Web-приложение в корне репозитория не изменяется.

## Назначение 14.1

- отдельный мобильный runtime;
- Expo Router;
- общий Supabase-проект `alantil-app`;
- персистентная мобильная auth-session через AsyncStorage;
- корректный foreground/background refresh токенов;
- чтение реального `v_words_app`;
- development / preview / production профили EAS;
- Android preview собирается как APK для установки без Google Play.

## Запуск

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```

Для реального development build:

```bash
npx expo install expo-dev-client
npx eas-cli@latest build --profile development --platform android
```

Для APK, который можно установить напрямую:

```bash
npx eas-cli@latest build --profile preview --platform android
```

## Supabase

Значения подключения находятся в `.env.example`. Используется только publishable key. `service_role` и другие секретные ключи в мобильный клиент не добавляются.

## Следующий этап

После проверки foundation: mobile OAuth/deep-link callback, onboarding, полноценный экран «Путь», словари, карточка слова и двусторонняя синхронизация прогресса.
