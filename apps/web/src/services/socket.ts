type SocketMessage = {
  event: string;
  code?: string;
  message?: string;
};

export function sendMessage(socket: WebSocket, data: Record<string, string>) {
  socket.send(JSON.stringify(data));
}

export function connectSocket(onMessage: (data: SocketMessage) => void) {
  const socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("🟢 socket conectado");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("📨 mensaje:", data);
    onMessage(data);
  };

  socket.onclose = () => {
    console.log("🔴 socket cerrado");
  };

  return socket;
}
