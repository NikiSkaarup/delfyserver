require('./connection');
const EvalResult = require('./models/evalResultLog');
const WebSocket = require('ws');
const generate = require('nanoid/generate');

const wss = new WebSocket.Server({ port: 8001 });

// Hosting WebSockets identified by joincode
// pretty much used as a hashmap
let hosts = {};

wss.on('connection', (ws) => {
    ws.on('message', (unParsed) => {
        const message = JSON.parse(unParsed);

        switch (message.type) {
            case 'feedback':
                feedback(ws, message);
                break;
            case 'voting':
                voting(ws, message);
                break;
            case 'host':
                doHost(ws, message);
                break;
            case 'join':
                join(ws, message);
                break;
            case 'feedback_done':
                feedback_done(ws, message);
                break;
            case 'store':
                store(ws, message);
                break;
            default:
                break;
        }
    });

    ws.on('close', (code, message) => {
        if (ws.isClient) {
            let host = hosts[ws.code];
            if (host) {
                host.clients = host
                    .clients
                    .filter((client) => client != ws);
            }
            updateHost(ws);
            console.log(`Removed client: ${code}, ${message}`);
        } else if (ws.isHost) {
            if (hosts[ws.code]) delete hosts[ws.code];
            console.log(`Removed host: ${code}, ${message}`);
        } else {
            console.log(`Removed who knows what: ${code}, ${message}`);
        }
    });

    console.log('new connection');
});

function store(ws, message) {
    if (ws.isHost) {
        let evaluation = EvalResult({
            config: ws.config,
            feedback: message.feedback,
            votes: message.results,
        });
        evaluation.save((err) => {
            if (err) {
                console.log('Storing data went wrong.');
                throw err;
            }
            // OK!!
        });
    }
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {string} message 
 */
function feedback_done(ws, message) {
    if (ws.isHost) {
        broadcastToClients(ws, JSON.stringify(message));
    }
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {string} message 
 */
function feedback(ws, message) {
    if (ws.isHost) {
        broadcastToClients(ws, JSON.stringify(message));
    } else {
        let temp = {
            positive: [],
            negative: [],
            general: []
        };
        temp.positive = message.data.positive
            .filter((item) => (!!item.val && item.val !== ''))
            .map(item => {
                do item.id = genRndString(10);
                while (checkArrayForId(temp.positive, item.id));
                return item;
            });
        temp.negative = message.data.negative
            .filter((item) => (!!item.val && item.val !== ''))
            .map(item => {
                do item.id = genRndString(10);
                while (checkArrayForId(temp.negative, item.id));
                return item;
            });
        temp.general = message.data.general
            .filter((item) => (!!item.val && item.val !== ''))
            .map(item => {
                do item.id = genRndString(10);
                while (checkArrayForId(temp.general, item.id));
                return item;
            });
        broadcastToHost(ws, JSON.stringify({
            type: 'feedback',
            data: temp
        }));
    }
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {string} message 
 */
function voting(ws, message) {
    if (ws.isHost) {
        // dunno yet
    } else {
        broadcastToHost(ws, JSON.stringify(message));
    }
}

/**
 * 
 * @param {WebSocket} host 
 * @param {string} message 
 */
function doHost(host, message) {
    console.log('Adding host');

    let code;
    do code = genRndString(5);
    while (hosts[code]);

    host.code = code;
    host.clients = [];
    hosts[host.code] = host;
    host.isHost = true;

    host.config = {
        type: 'config',
        code: host.code,
        title: message.title,
        positive: message.positive,
        negative: message.negative,
        amount: message.amount,
        general: message.general,
    };
    host.send(JSON.stringify(host.config), (error) => error && console.log(error));
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {string} message 
 */
function join(ws, message) {
    console.log('Adding client');
    const code = message.code;
    let host = hosts[code];

    if (!host) // inform client that no host with code exist
        return;

    ws.code = code;
    ws.isClient = true;

    if (message.userId === undefined) {
        let userId;
        do userId = genRndString(10);
        while (checkHostForUserId(host, userId));
        ws.userId = userId;
    } else {
        ws.userId = message.userId
    }
    host.clients.push(ws);
    const data = Object.assign({
        userId: ws.userId
    }, host.config);
    ws.send(JSON.stringify(data), (error) => error && console.log(error));
    updateHost(ws);
}

/**
 * 
 * @param {[]} arr 
 * @param {string} id 
 */
function checkArrayForId(arr, id) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === id)
            return true;
    }
    return false;
}

/**
 * check if userId exist on host's list of clients
 * 
 * @param {WebSocket} host 
 * @param {string} userId 
 */
function checkHostForUserId(host, userId) {
    for (let i = 0; i < host.clients.length; i++) {
        if (host.clients[i].userId === userId)
            return true;
    }
    return false;
}

/**
 * Update number of participants on host
 * 
 * @param {WebSocket} client 
 */
function updateHost(client) {
    let host = hosts[client.code];
    if (host) {
        broadcastToHost(client, JSON.stringify({
            type: 'update',
            data: host.clients.map((client) => {
                return {
                    type: 'client',
                    userId: client.userId
                }
            })
        }));
    }
}

/**
 * send data to all of the host's clients
 * 
 * @param {WebSocket} host 
 * @param {string} data 
 */
function broadcastToClients(host, data) {
    if (host.isHost) {
        host.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN)
                client.send(data, (error) => {
                    if (error) console.log(error);
                });
        });
    }
}

/**
 * send data to input client's host
 * 
 * @param {WebSocket} client 
 * @param {string} data 
 */
function broadcastToHost(client, data) {
    if (client.isClient) {
        const host = hosts[client.code];
        if (host && host.readyState === WebSocket.OPEN)
            host.send(data, (error) => {
                if (error) console.log(error);
            });
    }
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {string} message 
 */
function broadcast(ws, message) {
    console.log(`broadcasting: ${message}`);
    wss.clients.forEach((client) => {
        if (client === ws) return;
        if (client.readyState === WebSocket.OPEN)
            client.send(message, (error) => {
                if (error) console.log(error);
            });
    });
}

/**
 * Generates a random string of the input length
 * must be above or equal 1
 * 
 * @param {number} length 
 */
function genRndString(length) {
    if (isNaN(length) || length < 1) throw new Error('length must be a number of 1 or more');
    return generate('1234567890abcdefghijklmnopqrstuvwxyz', length);
}
