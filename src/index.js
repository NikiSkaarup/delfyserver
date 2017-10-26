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
            default:
                console.log(unParsed);
                broadcast(ws, unParsed);
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

    //ws.send('Connected');
    console.log('new connection');
});

function feedback(ws, message) {
    if (ws.isHost) {
        broadcastToClients(ws, message);
    } else {
        broadcastToHost(ws, message);
    }
}

function voting(ws, message) {
    console.log('Voting!');
}

function host(ws, message) {
    console.log('Adding host');
    let code = getCode();
    while (hosts[code])
        code = getCode();

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

    ws.send(JSON.stringify(ws.config));
}

function join(ws, message) {
    console.log('Adding client');
    const code = message.code;
    let host = hosts[code];
    if (!host) {
        // inform client that no host with code exist
        return;
    }
    ws.code = code;
    ws.isClient = true;

    host.clients.push(ws);
    ws.send(JSON.stringify(host.config));
    updateHost(ws);
}

function updateHost(ws) {
    let host = hosts[ws.code];
    if (host) {
        broadcastToHost(ws, JSON.stringify({
            type: 'update',
            data: host.clients.map(() => { client: 'client' })
        }));
    }
}

function broadcastToClients(ws, message) {
    ws.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN)
            client.send(message);
    });
}

function broadcastToHost(ws, message) {
    const host = hosts[ws.code];
    if (host)
        host.send(message);
}

function broadcast(ws, message) {
    console.log(`broadcasting: ${message}`);
    wss.clients.forEach((client) => {
        if (client === ws) return;
        if (client.readyState === WebSocket.OPEN)
            client.send(message);
    });
}

function getCode() {
    return generate('1234567890abcdefghijklmnopqrstuvwxyz', 5);
}
