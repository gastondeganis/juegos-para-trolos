import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";

const Lobby = () => {
  const { roomCode, playersList, errorMessage } = useSocket();
  const navigate = useNavigate();

  return (
    <div>
      <h2>Sala: {roomCode}</h2>
      <ul>
        {playersList.map((p) => (
          <li key={p.name}>{p.name}</li>
        ))}
      </ul>

      {/* Acá podrías chequear si el primer jugador de la lista es el host */}
      <button onClick={() => navigate("/")}>Atrás</button>

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
    </div>
  );
};

export default Lobby;
