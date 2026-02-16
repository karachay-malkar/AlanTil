// Можно вставлять ЛЮБУЮ ссылку на Google Sheets (даже /edit) — приложение само превратит её в CSV.
window.WORDS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1X2tc9THUxj0bZOQDdycEFGl7xJMqjUBYe7MsESWIUXI/edit?usp=sharing";

// Ключ кеша (быстрый старт)
window.WORDS_CACHE_KEY = "fc_words_cache_v3";

// (Необязательно) Человеческие названия папок.
window.FOLDER_TITLES = {
  "easy": "Простой",
  "mid": "Средний",
  "hard": "Сложный",
};

// Тестовые данные (если таблица недоступна)
window.WORDS_FALLBACK = [
  { id: 1, folder: "easy", set: 1, word: "окъургъа", trans: "читать", example: "китабны окъургъа - читать книгу" },
  { id: 2, folder: "easy", set: 1, word: "сау бол", trans: "спасибо", example: "Сау бол - спасибо" },
  { id: 3, folder: "easy", set: 1, word: "барыргъа", trans: "идти, ехать", example: "мен юйге барама - я иду домой" },
];



// === STEP 4: Dictionary content data requirements ===
// Required column in Google Sheets: dict_order
// - Local order inside EACH dictionary (starts from 1)
// - Used for sorting and display in "Содержание словаря"
// - If dict_order is empty or 0, the word is NOT shown in the dictionary content view.
//
// Expected headers (minimum):
// id, dict, section, set, word, trans, dict_order
//
// Example row:
// { id: 101, dict: 'Основной', section: 'Быт', set: 1, dict_order: 12, word: 'окъургъа', trans: 'читать' }

