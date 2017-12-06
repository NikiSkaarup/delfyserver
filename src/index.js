const WebSocket = require('ws');
const generate = require('nanoid/generate');

const wss = new WebSocket.Server({ port: 8001 });

let hosts = {};

wss.on('connection', (ws) => {
    ws.on('message', (unParsed) => {
        let message = JSON.parse(unParsed);

        switch (message.type) {
            case 'feedback':
                feedback(ws, message);
                break;
            case 'voting':
                voting(ws, message);
                break;
            case 'host':
                host(ws, message);
                break;
            case 'join':
                join(ws, message);
                break;
            case 'feedback_done':
                feedback_done(ws, message);
                break;
            default:
                console.log(unParsed);
                //broadcast(ws, unParsed);
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
            if (hosts[ws.code]) {
                delete hosts[ws.code];
            }
            console.log(`Removed host: ${code}, ${message}`);
        } else {
            console.log(`Removed who knows what: ${code}, ${message}`);
            // well fuck you didn't manage to do shit.
        }
    });

    console.log('new connection');
});

function feedback_done(ws, message) {
    if (ws.isHost) {
        broadcastToClients(ws, JSON.stringify(message));
    }
}

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

function voting(ws, message) {
    if (ws.isHost) {
        // dunno yet
    } else {
        broadcastToHost(ws, JSON.stringify(message));
    }
}

function host(ws, message) {
    console.log('Adding host');

    let code;
    do code = genRndString(5);
    while (host[code]);

    ws.code = code;
    ws.clients = [];
    hosts[ws.code] = ws;
    ws.isHost = true;

    let config = {
        type: 'config',
        code: ws.code,
        title: message.title,
        positive: message.positive,
        negative: message.negative,
        amount: message.amount,
        general: message.general,
    };
    ws.config = config;
    ws.send(JSON.stringify(ws.config), (error) => {
        if (error) console.log(error);
    });
}

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
    ws.send(JSON.stringify(Object.assign({
        userId: ws.userId
    }, host.config)), (error) => {
        if (error) console.log(error);
    });
    updateHost(ws);
}

function checkArrayForId(arr, id) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === id)
            return true;
    }
    return false;
}

function checkHostForUserId(host, userId) {
    for (let i = 0; i < host.clients.length; i++) {
        if (host.clients[i].userId === userId)
            return true;
    }
    return false;
}

function updateHost(ws) {
    let host = hosts[ws.code];
    if (host) {
        broadcastToHost(ws, JSON.stringify({
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

function broadcastToClients(ws, data) {
    if (ws.isHost) {
        ws.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN)
                client.send(data, (error) => {
                    if (error) console.log(error);
                });
        });
    }
}

function broadcastToHost(ws, data) {
    if (ws.isClient) {
        const host = hosts[ws.code];
        if (host && host.readyState === WebSocket.OPEN)
            host.send(data, (error) => {
                if (error) console.log(error);
            });
    }
}

function broadcast(ws, message) {
    console.log(`broadcasting: ${message}`);
    wss.clients.forEach((client) => {
        if (client === ws) return;
        if (client.readyState === WebSocket.OPEN)
            client.send(message, (error) => {
                if(error) console.log(error);
            });
    });
}

function genRndString(length) {
    if (isNaN(length)) throw new Error('length must be a number');
    return generate('1234567890abcdefghijklmnopqrstuvwxyz', length);
}
