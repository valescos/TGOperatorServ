require('dotenv').config();

const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Server } = require('socket.io');
const { Bot, GrammyError, HttpError } = require('grammy');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server( server, {
    cors: {
        origin: '*'
    }
})
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

app.use(cors());
app.use(bodyParser.json());

bot.api.setMyCommands([{
    command: 'start', description: 'Запускаем бота'
    }
]);

bot.on('message', async (ctx) => {
    //Ответ бота направляется по id сокета из базы
    if (ctx.message.is_topic_message && !ctx.from.is_bot) {
        const { data, err } = await supabase.from('ChatStore')
        .select('message_thread_id, socket_id')
        .eq('message_thread_id', ctx.message.message_thread_id);
        console.log(err);
        io.to(data[0].socket_id).emit('receive', ctx.message.text);
    }
})

io.on('connection', (socket) => {
    console.log('Новый клиент подключен: ', socket.id);

    socket.on("sendMessage", async (payload) => {
        // const topicID = topicList.map(e => e.name).includes(payload.visit_id) ? 
        // topicList.filter(e => e.name === payload.visit_id)[0].message_thread_id : false;
        const { data, err } = await supabase.from('ChatStore')
        .select('message_thread_id, name')
        .eq('name', payload.visit_id);
        console.log('err', err);
        console.log('data', data)

        if (data[0]) {
            //Обновление сокет id на случай переподключения
            const { error } = await supabase.from('ChatStore')
            .update({ socket_id: payload.socket_id })
            .eq('name', payload.visit_id);
            console.log(error);

            await bot.api.sendMessage(process.env.TELEGRAM_WORK_GROUP_ID, payload.text, {
                message_thread_id: data[0].message_thread_id
            });
        } else {
            //Создание нового топика с именем соотвествующим visit_id
            const newTopicID = await bot.api.createForumTopic(-1002343711971, payload.visit_id);

            console.log('newTopicID', newTopicID)

            //Создание в базе записи о новом visit_id и соотвествующим ему сокету и message_thread_id в супергруппе телеграм
            const { error } = await supabase.from('ChatStore').insert({ 
                message_thread_id: newTopicID.message_thread_id,
                name: newTopicID.name,
                socket_id: payload.socket_id
            })
            console.log(error);

            await bot.api.sendMessage(process.env.TELEGRAM_WORK_GROUP_ID, payload.text, {
                message_thread_id: newTopicID.message_thread_id
            })
        }
    })

    socket.on('disconnect', () => {
        console.log('Клиент отключился: ', socket.id);
    })
})


//Ошибки из доки GrammyJS
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Err while handling update: ${ctx.update.update_id}`);
    const e = err.error;

    if (e instanceof GrammyError) { 
        console.error(`Error in request: ${e.description}`);
    } else if (e instanceof HttpError) {
        console.error(`Could not reach Telegram: ${e}`);
    } else {
        console.error(`Unknown error: ${e}`);
    }
});

bot.start();
server.listen(process.env.PORT, () => {
    console.log(`Сервер работает на порте: ${process.env.PORT}`)
});