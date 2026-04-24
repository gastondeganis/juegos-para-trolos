import type { Player } from "../context/SocketContext";

// Lo que tu App de React espera consumir
type SocketMessage = {
  event: string;
  roomCode?: string;
  message?: string;
  players?: Array<Player>;
};

// La estructura real que viene por el cable según el nuevo contrato
interface RawResponse {
  event: string;
  data: {
    room_code?: string;
    message?: string;
    players?: Array<Player>;
  };
}

// Ahora sendMessage recibe el nombre del evento y los datos por separado
// para armar el sobre antes de mandarlo
export const sendMessage = (socket: WebSocket, event: string, data: any) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  } else if (socket.readyState === WebSocket.CONNECTING) {
    // Si está conectando, esperamos un poquito y reintentamos
    console.warn(
      `⏳ Socket conectando... reintentando envío de ${event} en 500ms`
    );
    setTimeout(() => sendMessage(socket, event, data), 500);
  } else {
    console.error(
      `🔴 No se pudo enviar ${event}: socket cerrado (estado: ${socket.readyState})`
    );
  }
};

export function connectSocket(onMessage: (data: SocketMessage) => void) {
  const socket = new WebSocket(import.meta.env.VITE_WS_URL);

  socket.onopen = () => {
    console.log("🟢 socket conectado");
  };

  socket.onmessage = (event) => {
    const response: RawResponse = JSON.parse(event.data);

    // Mapeamos la estructura anidada a la estructura plana que usa el Context
    const normalizedData: SocketMessage = {
      event: response.event,
      ...response.data,
      // Si viene room_code, lo asignamos a roomCode (camelCase para el front)
      roomCode: response.data?.room_code,
    };

    console.log("📨 mensaje normalizado:", normalizedData);
    onMessage(normalizedData);
  };

  socket.onclose = () => {
    console.log("🔴 socket cerrado");
  };

  return socket;
}
