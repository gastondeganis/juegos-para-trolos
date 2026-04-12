import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { connectSocket, sendMessage } from "../services/socket";

export type Player = {
  name: string;
  host: boolean;
};

interface SocketContextType {
  socket: WebSocket | null;
  roomCode: string;
  playersList: Player[];
  errorMessage: string;
  createRoom: (name: string) => void;
  joinRoom: (name: string, code: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [roomCode, setRoomCode] = useState("");
  const [playersList, setPlayerList] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = connectSocket((data) => {
      // Tu lógica de eventos que ya tenías
      if (
        (data.event === "room_created" || data.event === "room_joined") &&
        data.roomCode
      ) {
        setRoomCode(data.roomCode);
      }
      if (data.event === "players_updated") {
        setPlayerList(data.players ?? []);
      }
      if (data.event === "error") {
        setErrorMessage(data.message ?? "Ocurrió un error inesperado");
      }
    });

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const createRoom = (name: string) => {
    if (socketRef.current)
      sendMessage(socketRef.current, "create_room", { player_name: name });
  };

  const joinRoom = (name: string, code: string) => {
    socketRef.current?.send(
      JSON.stringify({
        event: "player_joined",
        player_name: name,
        room_code: code,
      })
    );
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        roomCode,
        playersList,
        errorMessage,
        createRoom,
        joinRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// Hook para usar el socket en cualquier lado
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context)
    throw new Error("useSocket debe usarse dentro de SocketProvider");
  return context;
};
