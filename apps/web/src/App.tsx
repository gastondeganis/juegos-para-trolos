import { useEffect, useRef, useState } from "react";
import { connectSocket, sendMessage } from "./services/socket";

function App() {
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = connectSocket((data) => {
      if (
        (data.event === "room_created" || data.event === "room_joined") &&
        data.code
      ) {
        setRoomCode(data.code);
      }

      if (data.event === "error") {
        alert(data.message);
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

  const handleJoinRoom = () => {
    if (!socketRef.current) return;

    sendMessage(socketRef.current, {
      event: "join_room",
      code: inputCode.toUpperCase(),
    });
  };

  return (
    <div>
      <h1>El Impostor</h1>

      <button onClick={handleCreateRoom}>Crear sala</button>

      <div style={{ marginTop: "16px" }}>
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Código de sala"
        />
        <button onClick={handleJoinRoom}>Unirse</button>
      </div>

      {roomCode && <p>Sala actual: {roomCode}</p>}
    </div>
  );
}

export default App;
