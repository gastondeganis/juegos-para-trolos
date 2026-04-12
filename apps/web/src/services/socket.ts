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
export function sendMessage(
  socket: WebSocket,
  event: string,
  payload: any = {}
) {
  const message = {
    event: event,
    data: payload,
  };
  socket.send(JSON.stringify(message));
}

export function connectSocket(onMessage: (data: SocketMessage) => void) {
  const socket = new WebSocket("ws://localhost:8080/ws");

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
