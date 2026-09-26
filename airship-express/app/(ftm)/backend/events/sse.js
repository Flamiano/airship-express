const clients = new Set();

function addClient(req, res) {
  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': '*',
  });

  const client = { req, res };
  clients.add(client);

  // send a ping every 25s to keep connection alive
  const ping = setInterval(() => {
    try { res.write('event: ping\n'); res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`); } catch { /* ignore */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    clients.delete(client);
  });
}

function broadcastAssignment(payload) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  clients.forEach(({ res }) => {
    try {
      res.write('event: assignment\n');
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      // ignore individual client errors
    }
  });
}

module.exports = { addClient, broadcastAssignment };
