import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const Lobby = () => {
  const { roomCode } = useParams();
  const { playersList } = useSocket();

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>El Impostor</h1>
      {/* Muestra el código de la sala desde la URL */}
      <h2>Sala {roomCode}</h2>

      <div style={{ margin: "20px 0" }}>
        <p>Esperando jugadores...</p>
        {/* Ruedita de carga simple con CSS */}
        <div
          className="spinner"
          style={{
            margin: "10px auto",
            width: "40px",
            height: "40px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3498db",
            borderRadius: "50%",
            animation: "spin 2s linear infinite",
          }}
        ></div>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {playersList.map((player, index) => (
          <li
            key={index}
            style={{
              fontSize: "1.5rem",
              margin: "10px 0",
              fontWeight: player.host ? "bold" : "normal",
            }}
          >
            {/* Si es host, mostramos la corona */}
            {player.host && <span title="Host">👑 </span>}
            {player.name}
          </li>
        ))}
      </ul>

      <button
        disabled
        style={{
          marginTop: "30px",
          padding: "15px 30px",
          fontSize: "1.2rem",
          cursor: "not-allowed",
          opacity: 0.6,
        }}
      >
        Jugar
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Lobby;
