const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8001 });

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        wss.clients.forEach(function each(client) {
            if(client === ws) return;
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
            console.log(data);
        });
    });

    ws.send('Connected!');
    console.log(ws + " connected");
});
