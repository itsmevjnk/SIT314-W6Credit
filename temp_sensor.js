/* read .env file */
require('dotenv').config();

const readline = require('readline'); // for reading keypresses
readline.emitKeypressEvents(process.stdin);

const uuid = require('crypto').randomUUID(); // get random UUID for identification (not that it's needed anyway, but it kind of helps)
console.log('simulated temperature sensor with UUID', uuid);

const http = require('http');
var temperature = 20.0;
setInterval(() => {
    var body = JSON.stringify({
        id: uuid,
        temperature: temperature
    });
    (new http.ClientRequest({
        hostname: '127.0.0.1', // localhost
        port: process.env.EDGE_PORT * 1, // convert to number (not sure if this is needed)
        path: '/temperature', // API endpoint
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    }))
        .on('error', (e) => {
            console.log('state submission failed:', e.message);
        })
        .end(body); // adapted from https://stackoverflow.com/questions/4505809/how-to-post-to-a-request-using-node-js
}, 2000); // send temperature every 2 seconds

if(process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('press W to increase temperature, S to decrease temperature, or Q to exit');

process.stdin.on('keypress', (chunk, key) => {
    if(key) {
        // console.log('Key pressed: ' + key.name);
        switch(key.name) {
            case 'w':
                temperature += 0.5;
                console.log('increased temperature to', temperature);
                break;
            case 's':
                temperature -= 0.5;
                console.log('decreased temperature to', temperature);
                break;
            case 'q':
                process.exit(0);
                break;
            default:
                break;
        }
    } 
});