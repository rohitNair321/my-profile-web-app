'use strict';

const clients = new Set();

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

// Keepalive comment every 25s to prevent proxy/load-balancer timeouts
setInterval(() => {
  for (const res of clients) {
    try {
      res.write(':ping\n\n');
    } catch {
      clients.delete(res);
    }
  }
}, 25_000);

module.exports = { addClient, removeClient, broadcast };
