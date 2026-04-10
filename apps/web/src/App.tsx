import { useEffect, useRef, useState } from "react";
import { connectSocket, sendMessage } from "./services/socket";

function App() {
  const [roomCode, setRoomCode] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = connectSocket((data) => {
      if (data.event === "room_created" && data.code) {
        setRoomCode(data.code);
      }
    });

    socketRef.current = socket;

    return () => socket.close();
  }, []);

  const handleCreateRoom = () => {
    if (!socketRef.current) return;

    sendMessage(socketRef.current, {
      event: "create_room",
    });
  };

  return (
    <div>
      <h1>El Impostor</h1>

      <button onClick={handleCreateRoom}>Crear sala</button>

      {roomCode && <p>Sala creada: {roomCode}</p>}
    </div>
  );
}

export default App;
