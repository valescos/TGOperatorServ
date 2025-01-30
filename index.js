const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    const update = req.body;

    console.log('Received update:', update);

    // if (update.message) {
    //     const chatId = update.message.chat.id;
    //     const text = update.message.text;

    //     console.log(`Message from chat ${chatId}: ${text}`);

    //     const response = {
    //         method: 'sendMessage',
    //         chat_id: chatId,
    //         text: `You said: ${text}`
    //     };

    //     res.json(response);
    // } else {
    //     res.sendStatus(200);
    // }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});