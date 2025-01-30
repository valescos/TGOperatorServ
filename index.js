const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    const update = req.body;
    console.log('message_thread_id', update.message.message_thread_id,
         'text', update.message.text, "is_bot", update.message.from.is_bot);
    res.sendStatus(200);
    }
);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});