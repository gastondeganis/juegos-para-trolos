export function connectSocket() {
  const socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("🟢 socket conectado");
  };

  socket.onmessage = (event) => {
    console.log("📨 mensaje:", event.data);
  };

  socket.onclose = () => {
    console.log("🔴 socket cerrado");
  };

  return socket;
}
