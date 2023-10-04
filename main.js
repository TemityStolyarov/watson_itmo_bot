const TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
const { group } = require('console');

const bot = new TelegramBot('TOKEN', {
    polling: true
});


bot.on("polling_error", err => console.log(err.data.error.message));

bot.on('text', async msg => {
    try {
        if (msg.text == '/start') {
            console.log(`Started: ${msg.chat.username}`);
            welcomeMessage(msg);
        }
    }
    catch (error) {
        console.log(error);
    }
})

var globalGroup = '';
var globalSubject = '';

bot.on('callback_query', async ctx => {
    try {

        if (ctx.data.startsWith('group_')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            globalGroup = ctx.data.slice(6);
            subjectMessage(ctx);
            return;
        }

        if (ctx.data.startsWith('subject_')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            globalSubject = ctx.data.slice(8);
            taskMessage(ctx);
            return;
        }

        if (ctx.data.startsWith('tasks_')) {
            console.log(`Get tasks: ${ctx.message.chat.username}`);
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            const data = openDataFile();
            //globalSubject = ctx.data.slice(14);
            var counter = 0;
            for (var taskKey in data[globalGroup][globalSubject]) {
                var task = data[globalGroup][globalSubject][taskKey];
                if (task.user[ctx.message.chat.username] == undefined || task.user[ctx.message.chat.username] == null) {
                    data[globalGroup][globalSubject][taskKey].user[ctx.message.chat.username] = {
                        'statusDone': false,
                    };
                    fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2), 'utf8');
                    data[globalGroup][globalSubject][taskKey].user[ctx.message.chat.username].statusDone = false;
                }
                if (task.user[ctx.message.chat.username].statusDone == false) {
                    ++counter;
                }
            }

            if (counter == 0) {
                await bot.sendMessage(ctx.message.chat.id, 'Все задания выполнены!',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Назад', callback_data: `back` },
                                ],
                            ]
                        }
                    }
                );
                return;
            }

            for (var taskKey in data[globalGroup][globalSubject]) {
                var task = data[globalGroup][globalSubject][taskKey];
                if (task.user[ctx.message.chat.username].statusDone == false) {
                    await bot.sendMessage(
                        ctx.message.chat.id,
                        `Task #${taskKey} (${globalSubject}):\n${task.title}\n${task.text}\nДедлайн: ${task.date}\n${task.comment}`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: 'Выполнено', callback_data: `doneTask_${taskKey}` },
                                        { text: 'Свернуть', callback_data: `hide_${taskKey}` },
                                    ],
                                ]
                            }
                        }
                    );
                }
            }
            await bot.sendMessage(ctx.message.chat.id, 'Нажми на кнопку "Выполнено" под любым из заданий, и оно перестанет отображаться у тебя\nНажми на кнопку "Свернуть" под любым из заданий, чтобы почистить переписку; такое задание отобразится снова в списке, когда ты запросишь у меня задания по предмету\n\nЧтобы снова начать диалог со мной, напиши /start или выйди в Главное меню',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Элементарно, Ватсон!', callback_data: `hide_` },
                                { text: 'Главное меню', callback_data: `back` },
                            ],
                        ]
                    }
                }
            );
            return;
        }

        if (ctx.data.startsWith('doneTask_')) {
            
            const data = openDataFile();
            var taskIndex = ctx.data.slice(9);
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            data[globalGroup][globalSubject][taskIndex].user[ctx.message.chat.username].statusDone = true;
            fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2), 'utf8');
            console.log(`Done task #${taskIndex}: ${ctx.message.chat.username}`);
            return;
        }

        if (ctx.data.startsWith('back')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            welcomeMessage(ctx.message);
            return;
        }

        if (ctx.data.startsWith('hide')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            return;
        }

        if (ctx.data.startsWith('add_task')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            bot.sendMessage(ctx.message.chat.id, 'Введите название нового задания:');
            bot.once('text', async newTaskTitleMsg => {
                bot.sendMessage(ctx.message.chat.id, 'Введите описание задания:');
                bot.once('text', async newTaskTextMsg => {
                    bot.sendMessage(ctx.message.chat.id, 'Введите дедлайн в формате ДД.ММ.ГГГГ:');
                    bot.once('text', async newTaskDateMsg => {
                        bot.sendMessage(ctx.message.chat.id, 'Введите комментарий в свободной форме (если комментарий не нужен, напишите -');
                        bot.once('text', async newTaskCommentMsg => {
                            const newTaskTitle = newTaskTitleMsg.text;
                            const newTaskText = newTaskTextMsg.text;
                            const newTaskDate = newTaskDateMsg.text;
                            const newTaskComment = newTaskCommentMsg.text;

                            if (newTaskTitle.startsWith('/')) {
                                newTaskTitle = newTaskTitle.slice(1);
                            }
                            if (newTaskText.startsWith('/')) {
                                newTaskText = newTaskText.slice(1);
                            }
                            if (newTaskDate.startsWith('/')) {
                                newTaskDate = newTaskDate.slice(1);
                            }
                            if (newTaskComment.startsWith('/')) {
                                newTaskComment = newTaskComment.slice(1);
                            }

                            const data = openDataFile();
                            const index = openIndexFile();

                            const by = ctx.message.chat.username;
                            data[globalGroup][globalSubject][index.taskIndex] = {
                                "title": newTaskTitle,
                                "text": newTaskText,
                                "date": newTaskDate,
                                "comment": newTaskComment,
                                "by" : by,
                                "user": {},
                            };
                            index.taskIndex = ++index.taskIndex;

                            fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2), 'utf8');
                            fs.writeFileSync('index.json', JSON.stringify(index, null, 2), 'utf8');
                            await bot.sendMessage(ctx.message.chat.id, 'Новая задача создана:\n\nНазвание задачи: ' + newTaskTitle + '\nОписание задания: ' + newTaskText + '\nДедлайн: ' + newTaskDate + '\nКомментарий: ' + newTaskComment);
                            console.log(`Add task: ${ctx.message.chat.username}`);
                            await welcomeMessage(ctx.message);
                        })
                    })
                })
            });
            return;
        }

        if (ctx.data.startsWith('add_group')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            bot.sendMessage(ctx.message.chat.id, 'Введите название новой группы:');
            bot.once('text', async newGroupMsg => {
                const newGroupName = newGroupMsg.text;

                if (newGroupName.startsWith('/')) {
                    newGroupName = newGroupName.slice(1);
                }

                const data = openDataFile();
                const by = ctx.message.chat.username;
                data[newGroupName] = {};

                const info = openInfoFile();
                info[newGroupName] = {
                    "by": by,
                }

                fs.writeFileSync('info.json', JSON.stringify(info, null, 2), 'utf8');
                fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2), 'utf8');
                bot.sendMessage(ctx.message.chat.id, 'Новая группа создана: ' + newGroupName);
                console.log(`Add group: ${ctx.message.chat.username}`);
                welcomeMessage(ctx.message);
            });
            return;
        }

        if (ctx.data.startsWith('add_subject')) {
            await bot.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
            bot.sendMessage(ctx.message.chat.id, 'Введите название нового предмета:');
            bot.once('text', async newSubjectMsg => {
                const newSubjectName = newSubjectMsg.text;

                if (newSubjectName.startsWith('/')) {
                    newSubjectName = newSubjectName.slice(1);
                }
                
                const data = openDataFile();
                data[globalGroup][newSubjectName] = {};

                const info = openInfoFile();
                const by = ctx.message.chat.username;
                if (info[globalGroup] == undefined) {
                    info[globalGroup] = {};
                }
                info[globalGroup][newSubjectName] = {
                    "by": by,
                }

                fs.writeFileSync('info.json', JSON.stringify(info, null, 2), 'utf8');
                fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2), 'utf8');
                bot.sendMessage(ctx.message.chat.id, 'Новый предмет создан: ' + newSubjectName);
                console.log(`Add subject: ${ctx.message.chat.username}`);
                welcomeMessage(ctx.message);
            });
            
            return;
        }
    }
    catch (error) {
        console.log(error);
    }
})

// ==================================================================
//                       F U N C T I O N S
// ==================================================================

function openDataFile() {
    try {
        var obj = JSON.parse(fs.readFileSync('tasks.json', 'utf8'));
        return obj;
    } catch (error) {
        console.error(`Got an error trying to write to a file: ${error.message}`);
    }
}

function openInfoFile() {
    try {
        var obj = JSON.parse(fs.readFileSync('info.json', 'utf8'));
        return obj;
    } catch (error) {
        console.error(`Got an error trying to write to a file: ${error.message}`);
    }
}

function openIndexFile() {
    try {
        var obj = JSON.parse(fs.readFileSync('index.json', 'utf8'));
        return obj;
    } catch (error) {
        console.error(`Got an error trying to write to a file: ${error.message}`);
    }
}

async function welcomeMessage(msg) {
    try {
        const DATA_FILE = 'tasks.json';
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            await bot.sendMessage(msg.chat.id, `Привет, ${(msg.chat.first_name == null) ? msg.chat.username : msg.chat.first_name}! Я Ватсон – помощник ИТМО УВБ для запоминания и менеджмента домашки. Выбери ниже номер группы:`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            ...Object.keys(data).map((group) => [{ text: group, callback_data: `group_${group}` }]),
                            [{ text: 'Добавить группу', callback_data: 'add_group' }],
                        ],
                    }
                }
            )
        }
        else {
            bot.sendMessage(msg.chat.id, `Произошла ошибка загрузки базы данных`);
            return;
        }
    }
    catch (err) {
        console.log(err);
    }
}

async function subjectMessage(ctx) {
    try {
        var group = ctx.data.slice(6);
        const DATA_FILE = 'tasks.json';
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            await bot.sendMessage(ctx.message.chat.id, `Группа ${group}. Выбери предмет:`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            ...Object.keys(data[group]).map((subject) => [{ text: subject, callback_data: `subject_${subject}` }]),
                            [{ text: 'Добавить предмет', callback_data: 'add_subject' },
                            { text: 'Назад', callback_data: 'back' }],
                            // [{ text: 'Все задания', callback_data: 'get_all_tasks' }],
                        ],
                    }
                }
            );
        }
        else {
            bot.sendMessage(msg.chat.id, `Произошла ошибка загрузки базы данных`);
            return;
        }
    }
    catch (err) {
        console.log(err);
    }
}

async function taskMessage(ctx) {
    try {
        var subject = ctx.data.slice(8);
        const DATA_FILE = 'tasks.json';
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            bot.sendMessage(ctx.message.chat.id, `Предмет ${subject}. Выбери, что ты хочешь сделать?`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Что задали?', callback_data: 'tasks_' }],
                            [{ text: 'Добавить задание', callback_data: 'add_task' },
                            { text: 'Назад', callback_data: 'back' }],
                        ]
                    }
                }
            );
        }
        else {
            bot.sendMessage(msg.chat.id, `Произошла ошибка загрузки базы данных`);
            return;
        }
    }
    catch (err) {
        console.log(err);
    }
}
