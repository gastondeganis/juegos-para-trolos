import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { connectSocket, sendMessage } from "../services/socket";
import { getOrCreatePlayerId } from "../services/utils";
import type { Player, GameData } from "../types";

export type { Player, GameData };

interface SocketContextType {
  socket: WebSocket | null;
  roomCode: string;
  playersList: Player[];
  errorMessage: string;
  notification: string;
  isConnected: boolean;
  gameData: GameData | null;
  createRoom: (name: string) => void;
  joinRoom: (name: string, code: string) => void;
  removePlayer: (playerID: string, roomCode: string) => void;
  startGame: () => void;
  sendGameEvent: (event: string, data?: Record<string, unknown>) => void;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [roomCode, setRoomCode] = useState("");
  const [playersList, setPlayerList] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [notification, setNotification] = useState("");
  const [gameData, setGameData] = useState<GameData | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReconnectRef = useRef(true);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = () => setErrorMessage("");

  useEffect(() => {
    function connect() {
      const socket = connectSocket((data) => {
        switch (data.event) {
          case "room_created":
          case "room_joined":
            setRoomCode(data.roomCode || "");
            if (data.players) setPlayerList(data.players);
            setErrorMessage("");
            break;

          case "players_updated":
            if (data.players) setPlayerList(data.players);
            break;

          case "game_state_updated":
            if (data.gameData) setGameData(data.gameData);
            break;

          case "notification":
            if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
            setNotification(data.message || "");
            notificationTimerRef.current = setTimeout(() => setNotification(""), 3500);
            break;

          case "player_joined_error":
          case "room_not_found":
            setErrorMessage(data.message || "Error al unirse a la sala");
            break;
        }
      });

      socket.onopen = () => {
        console.log("🟢 Conexión establecida");
        setIsConnected(true);
        intervalRef.current = setInterval(() => {
          sendMessage(socket, "ping", {});
        }, 30_000);
      };

      socket.onclose = () => {
        console.log("🔴 Conexión cerrada");
        setIsConnected(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (shouldReconnectRef.current) setTimeout(connect, 2000);
      };

      socketRef.current = socket;
    }

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const s = socketRef.current;
        if (!s || s.readyState === WebSocket.CLOSED || s.readyState === WebSocket.CLOSING) {
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      shouldReconnectRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
      socketRef.current?.close();
    };
  }, []);

  const createRoom = (name: string) => {
    if (!socketRef.current) return;
    setRoomCode("");
    setPlayerList([]);
    setGameData(null);
    setErrorMessage("");
    const hostId = getOrCreatePlayerId();
    localStorage.setItem("playerName", name);
    sendMessage(socketRef.current, "create_room", { host: name, host_id: hostId });
  };

  const joinRoom = (name: string, code: string) => {
    if (!socketRef.current) return;
    setRoomCode("");
    setPlayerList([]);
    setGameData(null);
    setErrorMessage("");
    const playerId = getOrCreatePlayerId();
    localStorage.setItem("playerName", name);
    sendMessage(socketRef.current, "player_joined", {
      player_id: playerId,
      player_name: name,
      room_code: code,
    });
  };

  const removePlayer = (playerID: string, roomCode: string) => {
    if (!socketRef.current) return;
    sendMessage(socketRef.current, "player_left", {
      player_id: playerID,
      room_code: roomCode,
    });
    setRoomCode("");
    setPlayerList([]);
    setGameData(null);
  };

  const startGame = () => {
    if (socketRef.current) sendMessage(socketRef.current, "start_game", {});
  };

  const sendGameEvent = (event: string, data: Record<string, unknown> = {}) => {
    if (socketRef.current) sendMessage(socketRef.current, event, data);
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        roomCode,
        playersList,
        errorMessage,
        notification,
        isConnected,
        gameData,
        createRoom,
        joinRoom,
        removePlayer,
        startGame,
        sendGameEvent,
        clearError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket debe usarse dentro de SocketProvider");
  return context;
};
