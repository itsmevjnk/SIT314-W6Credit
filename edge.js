/* read .env file */
require('dotenv').config();

/* MongoDB */
const mongoose = require('mongoose');
const sensorLog = mongoose.model('SensorLog', new mongoose.Schema({
    ip: String,
    timestamp: Date,
    path: String,
    data: Map
}, {
    collection: 'sensors'
}));
const settingLog = mongoose.model('SettingLog', new mongoose.Schema({
    timestamp: Date,
    data: Map
}, {
    collection: 'settings'
}));
const tempLog = mongoose.model('TempLog', new mongoose.Schema({
    timestamp: Date,
    temperature: Number,
    readings: Number
}, {
    collection: 'temperatures'
}));
mongoose.connect(process.env.EDGE_DB_URL);

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

/* helper for inserting sensor event into database */
function logSensorEvent(req) {
    sensorLog.create({
        ip: req.ip,
        timestamp: Date.now(),
        path: req.path,
        data: req.body
    }).catch((err) => {
        console.log('sensor event insertion failed:', err.Message);
    });
}

/* temperature sensor */
var tempReadings = []; // list of temperature readings
var tempAvg = null; // average temperature

app.post('/temperature', (req, res) => {
    // console.log(typeof req.body.temperature);
    if(typeof req.body.temperature !== 'number') {
        sendResponse(res, 400, null); // malformed POST request
        return;
    }

    tempReadings.push(req.body.temperature);
    console.log('received temperature reading:', req.body.temperature);

    logSensorEvent(req);
    sendResponse(res, 200, null);
});

/* chair sensor */
var occupiedSeats = 0;
var occupiedSeatsTimestamp = null;

app.post('/chair', (req, res) => {
    if(typeof req.body.occupied !== 'boolean') {
        sendResponse(res, 400, null); // malformed POST request
        return;
    }

    if(req.body.occupied) occupiedSeats++;
    else if(occupiedSeats > 0) occupiedSeats--;
    occupiedSeatsTimestamp = Date.now(); // only for status checks
    console.log('number of occupied seats:', occupiedSeats);

    logSensorEvent(req);
    sendResponse(res, 200, null);
});

/* status check */
app.get('/status', (req, res) => {
    sendResponse(res, 200, {
        temp: tempAvg,
        seats: (occupiedSeatsTimestamp === null) ? null : {
            timestamp: occupiedSeatsTimestamp,
            count: occupiedSeats
        }
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

const http = require('http'); // HTTP client (for sending data to HVAC node)

app.listen(process.env.EDGE_PORT, () => {
    console.log('edge node listening on port', process.env.EDGE_PORT);

    setInterval(() => {
        if(tempReadings.length == 0) {
            console.log('no temp readings in the last 30 seconds - check temp sensor nodes');
            return;
        }
    
        let tempSum = 0;
        for(const temp of tempReadings) tempSum += temp;
        tempAvg = {
            timestamp: Date.now(),
            value: tempSum / tempReadings.length
        }; // update average temperature
    
        tempLog.create({
            timestamp: tempAvg.timestamp,
            temperature: tempAvg.value,
            readings: tempReadings.length
        }).then((ans) => {
            console.log('avg temp reading on', tempAvg.timestamp, ':', tempAvg.value);
        }).catch((err) => {
            console.log('temperature insertion failed:', err.Message);
        }); // log to database
    
        tempReadings = []; // clear readings buffer to keep accumulating new values
    }, 30000); // update average temperature every 30 seconds

    setInterval(() => {
        if(tempAvg === null) return; // no temperature data yet

        const setting = {
            state: (occupiedSeats > 0),
            power: occupiedSeats,
            currentTemperature: tempAvg.value
        };
        settingLog.create({
            timestamp: Date.now(),
            data: setting
        });

        var body = JSON.stringify(setting);
        console.log('sending to HVAC node:', body);
        (new http.ClientRequest({
            hostname: '127.0.0.1', // localhost
            port: process.env.HVAC_PORT * 1, // convert to number (not sure if this is needed)
            path: '/control', // API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }))
            .on('error', (e) => {
                console.log('HVAC control failed:', e.message);
            })
            .end(body); // adapted from https://stackoverflow.com/questions/4505809/how-to-post-to-a-request-using-node-js
    }, 30000); // periodically send HVAC control commands
});
