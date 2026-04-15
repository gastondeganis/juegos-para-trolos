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
  clearError: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [roomCode, setRoomCode] = useState("");
  const [playersList, setPlayerList] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const clearError = () => {
    setErrorMessage("");
  };

  useEffect(() => {
    const socket = connectSocket((data) => {
      switch (data.event) {
        case "room_created":
        case "room_joined":
          setRoomCode(data.roomCode || "");
          // IMPORTANTE: El backend ya manda la lista con el host/jugador inicial acá
          // Usamos data.players porque socket.ts lo mapea desde el objeto data del backend
          if (data.players) {
            setPlayerList(data.players);
          }
          setErrorMessage("");
          break;
      }
    });
    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const createRoom = (name: string) => {
    if (socketRef.current) {
      // Limpiamos estados anteriores para que la nueva sala empiece de cero
      setRoomCode("");
      setPlayerList([]);
      setErrorMessage("");
      sendMessage(socketRef.current, "create_room", { host: name });
    }
  };

  const joinRoom = (name: string, code: string) => {
    if (socketRef.current) {
      // Limpiamos estados anteriores
      setRoomCode("");
      setPlayerList([]);
      setErrorMessage("");
      sendMessage(socketRef.current, "player_joined", {
        player_name: name,
        room_code: code,
      });
    }
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
        clearError,
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
