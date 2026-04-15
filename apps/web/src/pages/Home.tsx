import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const Home = () => {
  const [view, setView] = useState<"menu" | "join" | "create">("menu");
  const [name, setName] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrMsg] = useState("");

  // Traemos clearError del context para limpiar el estado global de errores
  const { createRoom, joinRoom, roomCode, errorMessage, clearError } =
    useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (roomCode) {
      navigate(`/lobby/${roomCode}`);
    }
  }, [roomCode, navigate]);

  // Función para resetear errores locales y globales al cambiar de vista o volver atrás
  const handleBack = () => {
    setErrMsg("");
    clearError();
    setView("menu");
  };

  const handleCreate = () => {
    if (!name) {
      setErrMsg("Por favor, ingresá tu nombre");
      return;
    }
    setErrMsg("");
    createRoom(name);
  };

  const handleJoin = () => {
    if (!name || !inputCode) {
      setErrMsg("Completá tu nombre y el código de sala");
    } else {
      setErrMsg("");
      joinRoom(name, inputCode);
    }
  };

  return (
    <div className="home-screen" style={{ padding: "20px" }}>
      <h1>El Impostor</h1>

      {view === "menu" && (
        <div className="menu-principal">
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "20px",
              fontSize: "20px",
              marginBottom: "10px",
            }}
            onClick={() => setView("join")}
          >
            Unirse a Sala
          </button>
          <button
            style={{
              display: "block",
              width: "100%",
              padding: "20px",
              fontSize: "20px",
            }}
            onClick={() => setView("create")}
          >
            Crear Sala
          </button>
        </div>
      )}

      {view === "join" && (
        <div className="unirse-sala">
          <h2>Unirse a Sala</h2>
          <input
            placeholder="Código de Sala"
            value={inputCode}
            style={{
              display: "block",
              margin: "10px auto",
              padding: "10px",
              // El borde rojo solo aparece si el error es de tipo "room_not_found"
              border: errorMessage.includes("not found")
                ? "2px solid red"
                : "1px solid #ccc",
            }}
            onChange={(e) => {
              setInputCode(e.target.value.toUpperCase());
              if (errorMessage) clearError(); // Limpia el error apenas el usuario vuelve a escribir
            }}
          />

          <input
            placeholder="Tu Nombre"
            value={name}
            style={{ display: "block", margin: "10px auto", padding: "10px" }}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMsg) setErrMsg(""); // Limpia error local
            }}
          />
          <button
            className="btn-grande"
            style={{
              display: "block",
              margin: "20px auto",
              padding: "15px 40px",
              fontSize: "18px",
            }}
            onClick={handleJoin}
          >
            Entrar
          </button>
          <button onClick={handleBack}>Atrás</button>
        </div>
      )}

      {view === "create" && (
        <div className="nueva-sala">
          <h2>Nueva Sala</h2>
          <input
            placeholder="Tu Nombre"
            value={name}
            style={{ display: "block", margin: "10px auto", padding: "10px" }}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMsg) setErrMsg("");
            }}
          />
          <button
            style={{
              display: "block",
              margin: "10px auto",
              padding: "10px 20px",
            }}
            onClick={handleCreate}
          >
            Crear Sala
          </button>
          <button onClick={handleBack}>Atrás</button>
        </div>
      )}

      {/* Mostrar solo el mensaje pertinente */}
      {(errorMsg || errorMessage) && (
        <p style={{ color: "red", marginTop: "20px", fontWeight: "bold" }}>
          {errorMessage || errorMsg}
        </p>
      )}
    </div>
  );
};

export default Home;
