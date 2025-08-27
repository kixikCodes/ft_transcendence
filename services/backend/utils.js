export function broadcaster(clients, ws, msg) {
  for (const client of clients) {
    if (client !== ws && client.readyState === 1) {
		console.log("Broadcasting message to client: ", msg);
      client.send(msg);
    }
  }
}
