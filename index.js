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
const io = new Server( server, { cors: {
    origin: "*",
  }})
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

app.use(cors());
app.use(bodyParser.json());

bot.api.setMyCommands([{
    command: 'start', description: 'Запускаем бота'
    }
]);

bot.on('message', async (ctx) => {
    //Ответ бота направляется по id сокета из базы
    //operator_msg_que

    if (ctx.message.is_topic_message && !ctx.from.is_bot) {
        const { data, err } = await supabase.from('ChatStore')
        .select('message_thread_id, socket_id, operator_msg_que, operator_msg_que')
        .eq('message_thread_id', ctx.message.message_thread_id);
        console.log(err);

        console.log('DATA>>>>', data)

        if (io.sockets.sockets.has(data[0].socket_id)) {
        io.to(data[0].socket_id).emit('receive', ctx.message.text);
        } else {
        const msgQue = data[0].operator_msg_que ?
        [...data[0].operator_msg_que, ctx.message.text] :
        [ ctx.message.text ]

        const { error } = await supabase.from('ChatStore')
        .update({ operator_msg_que: msgQue })
        .eq('message_thread_id', ctx.message.message_thread_id);
        }
    }
})

io.on('connection', async (socket) => {
    console.log('Новый клиент подключен: ', socket.id);
    console.log('Доп. параметры: ', socket.handshake.query.visit_id);

    const { data, err } = await supabase.from('ChatStore')
    .select('name').eq('name', socket.handshake.query.visit_id);

    console.log(data)

    //handleHandshake(socket.handshake.query.visit_id, socket.id);

    socket.on("sendMessage", async (payload) => {
        const { data, err } = await supabase.from('ChatStore')
        .select('message_thread_id').eq('socket_id', socket.id);

        if (data[0]) {
        await bot.api.sendMessage(process.env.TELEGRAM_WORK_GROUP_ID, payload.text, {
            message_thread_id: data[0].message_thread_id
        });
        } else {
        console.error('Телеграмм-топик отсутствует')
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


async function handleHandshake(visit_id, socket_id) {
    const { data, err } = await supabase.from('ChatStore')
    .select('name').eq('name', visit_id);

    //обработка сокет-рукопожатия
    if (data[0]) { 
        //Обновление сокет id на случай переподключения
        const { error } = await supabase.from('ChatStore')
        .update({ socket_id: socket_id })
        .eq('name', data.name);
    } else {
        //Создание нового топика с именем соотвествующим visit_id
        const newTopicID = await bot.api.createForumTopic(-1002343711971, data.name);
        //Создание в базе записи о новом visit_id и соотвествующим ему сокету и message_thread_id в супергруппе телеграм
        const { error } = await supabase.from('ChatStore').insert({ 
        message_thread_id: newTopicID.message_thread_id,
        name: newTopicID.name,
        socket_id: socket_id
        })
    }
}