// --- КОНФИГУРАЦИЯ ---
const TelegramBot = require('node-telegram-bot-api');

// 1. ВАШ ТОКЕН, который вы получили от BotFather (ОБЯЗАТЕЛЬНО ЗАМЕНИТЬ!)
const TOKEN = '8094072010:AAH2Wtqedk7L3t7Gj2iQlUFaPyXggTW1SGs'; 
// 2. ВАШ ЛИЧНЫЙ ID ЧАТА (Куда будут приходить уведомления о бронях) (ОБЯЗАТЕЛЬНО ЗАМЕНИТЬ!)
const ADMIN_CHAT_ID = '418419726'; 
// Чтобы узнать свой ID, отправьте любое сообщение боту @userinfobot

// Добавьте эту функцию в начало файла bot.js (после const ADMIN_CHAT_ID = ...)
function escapeMarkdown(text) {
    // Экранирование символов, которые могут сломать Markdown
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ...
// ... Далее, в коде, где вы формируете adminMessage, примените эту функцию.
// В двух местах, где вы формируете adminMessage, измените строки:

// Пример 1: Обработка брони (строки 131-138 в моём примере)
// Должно быть:
        const adminMessage = `
**🚨 НОВАЯ БРОНЬ ЧЕРЕЗ БОТА 🚨**
От: @${msg.from.username || msg.from.id}
---
**Дата:** ${escapeMarkdown(userData.date)}
**Время:** ${escapeMarkdown(userData.time)}
**Персон:** ${escapeMarkdown(userData.people)}
**Контакт:** ${escapeMarkdown(userData.contact)}
        `;

// Пример 2: Обработка связи с управляющим (строки 164-167 в моём примере)
// Должно быть:
        const adminMessage = `
**📞 НОВОЕ ОБРАЩЕНИЕ К УПРАВЛЯЮЩЕМУ**
От: @${msg.from.username || msg.from.id}
---
**Сообщение:** ${escapeMarkdown(text)}
        `;

const bot = new TelegramBot(TOKEN, { polling: true }); // Режим опроса (polling) для локального тестирования

// --- ХРАНЕНИЕ СОСТОЯНИЙ (В РЕАЛЬНОМ ПРОЕКТЕ ИСПОЛЬЗУЮТ БАЗУ ДАННЫХ) ---
const userStates = {}; // Для хранения текущего состояния пользователя
const STATES = {
    START: 'start',
    WAITING_DATE: 'waiting_date',
    WAITING_TIME: 'waiting_time',
    WAITING_PEOPLE: 'waiting_people',
    WAITING_NAME_PHONE: 'waiting_name_phone', // Сбор имени и телефона
    WAITING_ADMIN_MESSAGE: 'waiting_admin_message' // Сбор сообщения для управляющего
};

// --- ОПРЕДЕЛЕНИЕ КЛАВИАТУРЫ ---
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🍽️ Забронировать стол' }],
            [{ text: '📞 Связаться с управляющим' }, { text: 'ℹ️ Контакты' }]
        ],
        resize_keyboard: true // Адаптирует размер под экран
    }
};

// --- ОСНОВНАЯ ЛОГИКА ---

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = { step: STATES.START, data: {} };
    
    bot.sendMessage(chatId, 
        `Здравствуйте, ${msg.from.first_name || 'Гость'}! Я бот ресторана. Выберите, что вы хотите сделать:`, 
        mainMenuKeyboard
    );
});

// Обработка текстовых сообщений (включая нажатия кнопок)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Игнорируем команды и пустые сообщения
    if (text === undefined || text.startsWith('/')) return;

    // Если пользователь еще не начинал, отправляем его на старт
    if (!userStates[chatId]) {
        return bot.sendMessage(chatId, 'Пожалуйста, начните с команды /start.');
    }

    const currentState = userStates[chatId].step;
    
    // ----------------------------------------------------------------
    // --- ОБРАБОТКА ГЛАВНОГО МЕНЮ И ПЕРЕХОДОВ ---
    // ----------------------------------------------------------------

    if (text === '🍽️ Забронировать стол') {
        userStates[chatId] = { step: STATES.WAITING_DATE, data: {} }; // Сброс данных и переход к бронированию
        bot.sendMessage(chatId, 'Отлично! На какую дату вы хотите забронировать стол? (Например: **15.10**)', { parse_mode: 'Markdown' });
    } else if (text === '📞 Связаться с управляющим') {
        bot.sendMessage(chatId, 'Опишите ваш вопрос или оставьте отзыв. Мы передадим его управляющему.');
        userStates[chatId].step = STATES.WAITING_ADMIN_MESSAGE; // Переход в режим связи
    } else if (text === 'ℹ️ Контакты') {
        bot.sendMessage(chatId, 
            'Наш адрес: **Улица Пушкина, дом Колотушкина**.\nТелефон: **+7(123)456-78-90**\nРаботаем: **с 10:00 до 23:00**.', 
            { parse_mode: 'Markdown', ...mainMenuKeyboard }
        );
        userStates[chatId].step = STATES.START; // Возвращаем в начальное состояние
    }

    // ----------------------------------------------------------------
    // --- СЦЕНАРИЙ БРОНИРОВАНИЯ (ПОШАГОВАЯ ЛОГИКА) ---
    // ----------------------------------------------------------------

    else if (currentState === STATES.WAITING_DATE) {
        userStates[chatId].data.date = text;
        userStates[chatId].step = STATES.WAITING_TIME;
        bot.sendMessage(chatId, `Дата: **${text}**. Теперь укажите время (Например: **19:30**).`, { parse_mode: 'Markdown' });
    } else if (currentState === STATES.WAITING_TIME) {
        userStates[chatId].data.time = text;
        userStates[chatId].step = STATES.WAITING_PEOPLE;
        bot.sendMessage(chatId, `Время: **${text}**. На сколько человек? (Укажите число).`, { parse_mode: 'Markdown' });
    } else if (currentState === STATES.WAITING_PEOPLE) {
        userStates[chatId].data.people = text;
        userStates[chatId].step = STATES.WAITING_NAME_PHONE;
        bot.sendMessage(chatId, `Отлично! И, наконец, ваше **Имя и Телефон** для связи.`, { parse_mode: 'Markdown' });
    } 
    
    // ----------------------------------------------------------------
    // --- ФИНАЛЬНЫЙ ШАГ (ОБРАБОТКА БРОНИ) ---
    // ----------------------------------------------------------------

    else if (currentState === STATES.WAITING_NAME_PHONE) {
        const userData = userStates[chatId].data;
        userData.contact = text;
        
        // 1. Формирование сообщения для Администратора
        const adminMessage = `
**🚨 НОВАЯ БРОНЬ ЧЕРЕЗ БОТА 🚨**
От: @${msg.from.username || msg.from.id}
---
**Дата:** ${userData.date}
**Время:** ${userData.time}
**Персон:** ${userData.people}
**Контакт:** ${userData.contact}
        `;

        // 2. Уведомление Администратора (ВАС)
        bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' });
        
        // 3. Ответ Пользователю
        bot.sendMessage(chatId, 
            '✅ Ваша бронь принята и передана администратору. Ждем вас!', 
            mainMenuKeyboard
        );
        
        // Сброс состояния
        userStates[chatId] = { step: STATES.START, data: {} };
    }
    
    // ----------------------------------------------------------------
    // --- ФИНАЛЬНЫЙ ШАГ (ОБРАБОТКА СВЯЗИ) ---
    // ----------------------------------------------------------------

    else if (currentState === STATES.WAITING_ADMIN_MESSAGE) {
        const adminMessage = `
**📞 НОВОЕ ОБРАЩЕНИЕ К УПРАВЛЯЮЩЕМУ**
От: @${msg.from.username || msg.from.id}
---
**Сообщение:** ${text}
        `;
        
        // 1. Уведомление Администратора (ВАС)
        bot.sendMessage(ADMIN_CHAT_ID, adminMessage, { parse_mode: 'Markdown' });
        
        // 2. Ответ Пользователю
        bot.sendMessage(chatId, 
            '✅ Ваше сообщение передано управляющему. Ожидайте ответа.', 
            mainMenuKeyboard
        );
        
        // Сброс состояния
        userStates[chatId] = { step: STATES.START, data: {} };
    }
});

console.log('Бот запущен и ждет сообщений...');

// Логирование ошибок
bot.on('polling_error', (error) => {
    console.error(`Ошибка при работе бота: ${error.code} - ${error.message}`);
});
