# Настройка Google Analytics 4 для AlanTil 11.6

## 1. Обязательная настройка потока данных

Код приложения отправляет просмотры SPA вручную и использует `send_page_view: false`.

В Google Analytics необходимо открыть:

**Администратор → Сбор и изменение данных → Потоки данных → Web-поток AlanTil → Расширенная статистика → Просмотры страниц → Дополнительные настройки**

Отключить:

**Изменения страницы на основе событий истории браузера**

Обычную отправку просмотра при загрузке страницы также не использовать как отдельный механизм. После настройки каждый публичный URL должен создавать ровно один `page_view`, отправленный Router.

## 2. Пользовательские измерения событий

После появления первых событий создать пользовательские определения с областью **Событие**:

- `app_version`
- `screen_name`
- `activity_type`
- `direction`
- `dictionary_id`
- `section_id`
- `set_id`
- `playlist_id`
- `song_id`
- `search_area`
- `search_mode`
- `cancel_reason`
- `source`
- `result`

Название параметра события должно полностью совпадать с указанным значением.

## 3. Пользовательские метрики событий

Создать пользовательские метрики с областью **Событие**:

- `duration_sec`
- `active_duration_sec`
- `items_total`
- `items_completed`
- `known_count`
- `unknown_count`
- `correct_count`
- `wrong_count`
- `errors_count`
- `accuracy_percent`
- `progress_percent`
- `listened_sec`
- `result_count`

Для длительности использовать секунды. Для количества и процентов — стандартные числовые единицы.

## 4. Проверка DebugView

Открыть сайт с параметром:

`?analytics_debug=1`

Проверить:

1. первое открытие и `app_open`;
2. по одному `page_view` для `/`, `/learn`, `/test`, `/match`, `/songs`, `/settings`;
3. прямое открытие `/song/S0001`;
4. Back и Forward;
5. `activity_start`, `activity_complete`, `activity_abandon` для Learn, Test и Match;
6. `song_play`, `song_pause`, `song_progress`, `song_complete`;
7. события избранного;
8. `search_result` или `search_empty` без текста запроса;
9. отсутствие повторных `page_view`, `activity_complete`, `activity_abandon` и `song_complete`.

## 5. Отчёты

После накопления данных создать исследования GA4:

- посещаемость и время по `screen_name`;
- воронка `activity_start → activity_complete / activity_abandon` по `activity_type`;
- результаты и длительность по `direction`, `limit`, `dictionary_id`, `section_id`, `set_id`;
- открытия, запуски и завершения песен по `playlist_id` и `song_id`;
- добавления и удаления избранного по `item_id` и типу события.
