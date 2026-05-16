import type { Player, GameData } from "../types";

export type SocketMessage = {
  event: string;
  roomCode?: string;
  message?: string;
  players?: Player[];
  gameData?: GameData;
};

interface RawResponse {
  event: string;
  data: Record<string, unknown>;
}

export const sendMessage = (socket: WebSocket, event: string, data: Record<string, unknown>) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  } else if (socket.readyState === WebSocket.CONNECTING) {
    console.warn(`⏳ Socket conectando... reintentando envío de ${event} en 500ms`);
    setTimeout(() => sendMessage(socket, event, data), 500);
  } else {
    console.error(`🔴 No se pudo enviar ${event}: socket cerrado (estado: ${socket.readyState})`);
  }
};

export function connectSocket(onMessage: (data: SocketMessage) => void) {
  const socket = new WebSocket(import.meta.env.VITE_WS_URL);

  socket.onopen = () => {
    console.log("🟢 socket conectado");
  };

  socket.onmessage = (event) => {
    const response: RawResponse = JSON.parse(event.data as string);

    const normalized: SocketMessage = {
      event: response.event,
      roomCode: response.data?.room_code as string | undefined,
      message: response.data?.message as string | undefined,
      players: response.data?.players as Player[] | undefined,
    };

    if (response.event === "game_state_updated") {
      normalized.gameData = response.data as unknown as GameData;
    }

    console.log("📨 mensaje:", normalized);
    onMessage(normalized);
  };

  socket.onclose = () => {
    console.log("🔴 socket cerrado");
  };

  return socket;
}
