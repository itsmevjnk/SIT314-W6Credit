/* read .env file */
require('dotenv').config();

/* HTTP server */
const express = require('express');
const app = express();
app.use(express.json()); // for parsing JSON data

/* helper for sending standardised response */
function sendResponse(res, code, payload) {
    console.log(res.req.ip, res.req.method, res.req.path, '->', code); // log to terminal   
    res.status(code)
        .json({
            status: code,
            data: payload,
            timestamp: Date.now()
        }); // quicker than setting Content-Type then res.end()
}

/* HVAC control endpoint */
var lastCommand = null; // for status endpoint
app.post('/control', (req, res) => {
    /* extract settings */
    let state = req.body.state;
    let power = req.body.power;
    let temp = req.body.currentTemperature;

    if(typeof state !== 'boolean') {
        sendResponse(res, 400, null);
        return;
    }

    if(!state) console.log('HVAC turned off');
    else {
        if(typeof power !== 'number' || typeof temp !== 'number') {
            sendResponse(res, 400, null);
            return;
        }

        console.log('HVAC turned on with responsiveness', power, '- current temperature:', temp);
    }

    lastCommand = req.body;
    sendResponse(res, 200, null);
});

/* status check */
app.get('/status', (req, res) => {
    sendResponse(res, 200, {
        lastCommand: lastCommand
    });
});

/* default route - 404 or 400 (for unsupported methods) */
app.get('*', (req, res) => { sendResponse(res, 404, null); });
app.post('*', (req, res) => { sendResponse(res, 404, null); });
app.head('*', (req, res) => { sendResponse(res, 400, null); });
app.put('*', (req, res) => { sendResponse(res, 400, null); });
app.delete('*', (req, res) => { sendResponse(res, 400, null); });
app.connect('*', (req, res) => { sendResponse(res, 400, null); });
app.options('*', (req, res) => { sendResponse(res, 400, null); });
app.trace('*', (req, res) => { sendResponse(res, 400, null); });
app.patch('*', (req, res) => { sendResponse(res, 400, null); });

app.listen(process.env.HVAC_PORT, () => {
    console.log('HVAC controller node listening on port', process.env.HVAC_PORT);
});
