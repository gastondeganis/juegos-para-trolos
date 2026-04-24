import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import Modal from "../../components/Modal/Modal";
import "./Home.css";

const Home = () => {
  const [view, setView] = useState<"menu" | "join" | "create">("menu");
  const [name, setName] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [errorMsg, setErrMsg] = useState("");

  const { createRoom, joinRoom, roomCode, errorMessage, clearError } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (roomCode) navigate(`/lobby/${roomCode}`);
  }, [roomCode, navigate]);

  const handleBack = () => {
    setErrMsg("");
    clearError();
    setView("menu");
  };

  const handleCreate = () => {
    if (!name.trim()) { setErrMsg("Ingresá tu nombre"); return; }
    setErrMsg("");
    createRoom(name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !inputCode.trim()) {
      setErrMsg("Completá tu nombre y el código de sala");
      return;
    }
    setErrMsg("");
    joinRoom(name.trim(), inputCode.trim());
  };

  return (
    <div className="home">
      <h1>El Impostor</h1>
      <p className="home__subtitle">Juego de roles y traición</p>

      {view === "menu" && (
        <nav className="menu">
          <button className="menu__btn" onClick={() => setView("join")}>
            Unirse a Sala
            <span className="menu__btn-arrow">→</span>
          </button>
          <button className="menu__btn" onClick={() => setView("create")}>
            Crear Sala
            <span className="menu__btn-arrow">→</span>
          </button>
        </nav>
      )}

      {view === "join" && (
        <div className="form-view">
          <h2>Unirse a Sala</h2>
          <div className="form-view__fields">
            <input
              className={`input${errorMessage.includes("not found") ? " input--error" : ""}`}
              placeholder="Código de sala"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.toUpperCase());
                if (errorMessage) clearError();
              }}
            />
            <input
              className="input"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrMsg("");
              }}
            />
          </div>
          <div className="form-view__footer">
            <button className="btn btn--primary" onClick={handleJoin}>
              Entrar
            </button>
            <button className="form-view__back" onClick={handleBack}>
              ← Volver
            </button>
          </div>
          {(errorMsg || errorMessage) && (
            <p className="error-text">{errorMessage || errorMsg}</p>
          )}
        </div>
      )}

      {view === "create" && (
        <div className="form-view">
          <h2>Nueva Sala</h2>
          <div className="form-view__fields">
            <input
              className="input"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrMsg("");
              }}
            />
          </div>
          <div className="form-view__footer">
            <button className="btn btn--primary" onClick={handleCreate}>
              Crear Sala
            </button>
            <button className="form-view__back" onClick={handleBack}>
              ← Volver
            </button>
          </div>
          {errorMsg && <p className="error-text">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
};

export default Home;
