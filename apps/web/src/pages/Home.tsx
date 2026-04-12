import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext"; // Importamos nuestro hook

const Home = () => {
  const [view, setView] = useState<"menu" | "join">("menu");
  const [name, setName] = useState("");
  const [errorMsg, setErrMsg] = useState("");
  const [inputCode, setInputCode] = useState(""); // Estado para el código de sala

  const navigate = useNavigate();

  // Extraemos lo necesario del contexto
  const { createRoom, joinRoom, roomCode, errorMessage } = useSocket();

  useEffect(() => {
    if (roomCode) {
      navigate(`/lobby/${roomCode}`, {
        state: { playerName: name },
      });
    }
  }, [roomCode, navigate, name]);

  const handleCreate = () => {
    name ? createRoom(name) : setErrMsg("Escribí tu nombre");
  };

  const handleJoin = () => {
    if (!name || !inputCode) {
      setErrMsg("Completá todo");
    } else {
      joinRoom(name, inputCode);
    }
  };

  return (
    <div className="home-screen">
      <h1>El Impostor</h1>

      {view === "menu" ? (
        <div className="actions">
          {/* El input de nombre lo pedimos siempre al principio para que quede guardado */}
          <input
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrMsg("");
            }}
          />
          <hr />
          <button onClick={() => setView("join")}>Unirse a Sala</button>
          <button onClick={handleCreate}>Nueva Sala</button>
        </div>
      ) : (
        <div className="form">
          <p>Unirse a una sala existente</p>
          <input
            placeholder="Código de sala"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          />
          <button onClick={handleJoin}>Entrar</button>
          <button onClick={() => setView("menu")}>Atrás</button>
        </div>
      )}

      {errorMsg && (
        <p style={{ color: "red", marginTop: "10px" }}>{errorMsg}</p>
      )}

      {errorMessage && (
        <p style={{ color: "red", marginTop: "10px" }}>{errorMessage}</p>
      )}
    </div>
  );
};

export default Home;
