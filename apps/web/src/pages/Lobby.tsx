// apps/web/src/pages/Lobby.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const Lobby = () => {
  const { roomCode } = useParams();
  const { playersList, joinRoom, isConnected } = useSocket();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!isConnected || !roomCode || isJoining) return;

    const savedName = localStorage.getItem("playerName");
    const playerId = localStorage.getItem("playerId");
    const isAlreadyInList = playersList.some((p) => p.id === playerId);

    if (!isAlreadyInList && savedName) {
      setIsJoining(true); // Bloqueamos futuros intentos
      joinRoom(savedName, roomCode);
    } else if (!isAlreadyInList && !savedName) {
      setShowJoinModal(true);
    } else if (isAlreadyInList) {
      // Si ya aparecemos en la lista, podemos liberar el flag y cerrar modal
      setIsJoining(false);
      setShowJoinModal(false);
    }
  }, [playersList, roomCode, joinRoom, isConnected, isJoining]);

  const handleJoinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (nameInput.trim() && roomCode && !isJoining) {
      setIsJoining(true);
      joinRoom(nameInput.trim(), roomCode);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(e.target.value);
  };

  return (
    <div style={containerStyle}>
      <h1>El Impostor</h1>
      <h2>Sala {roomCode}</h2>

      {/* POPUP DE BIENVENIDA */}
      {showJoinModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>¡Hola!</h3>
            <p>Ingresá tu nombre para jugar:</p>
            <form onSubmit={handleJoinSubmit}>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={handleInputChange}
                style={inputStyle}
                placeholder="Tu nombre..."
              />
              <br />
              <button type="submit" style={buttonStyle}>
                Unirse a la Sala
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ margin: "20px 0" }}>
        <p>Esperando jugadores ({playersList.length})...</p>
        <div className="spinner" style={spinnerStyle}></div>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {playersList.map((player) => (
          <li
            key={player.id}
            style={{
              fontSize: "1.5rem",
              margin: "10px 0",
              fontWeight: player.host ? "bold" : "normal",
              color:
                player.id === localStorage.getItem("playerId")
                  ? "#3498db"
                  : "white",
            }}
          >
            {player.host && <span title="Host">👑 </span>}
            {player.name}{" "}
            {player.id === localStorage.getItem("playerId") && "(Vos)"}
          </li>
        ))}
      </ul>

      <button disabled style={playButtonStyle}>
        Jugar
      </button>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// --- Estilos ---
const containerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px",
  minHeight: "100vh",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.9)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "40px",
  borderRadius: "12px",
  border: "2px solid #3498db",
  width: "320px",
};

const inputStyle: React.CSSProperties = {
  padding: "12px",
  width: "90%",
  marginBottom: "20px",
  borderRadius: "6px",
  border: "1px solid #444",
  backgroundColor: "#333",
  color: "white",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 25px",
  cursor: "pointer",
  backgroundColor: "#3498db",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontWeight: "bold",
};

const playButtonStyle: React.CSSProperties = {
  marginTop: "30px",
  padding: "15px 40px",
  fontSize: "1.2rem",
  cursor: "not-allowed",
  opacity: 0.5,
  borderRadius: "8px",
};

const spinnerStyle: React.CSSProperties = {
  margin: "10px auto",
  width: "40px",
  height: "40px",
  border: "4px solid #333",
  borderTop: "4px solid #3498db",
  borderRadius: "50%",
  animation: "spin 1.5s linear infinite",
};

export default Lobby;
