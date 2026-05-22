import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import Modal from "../../components/Modal/Modal";
import "./Lobby.css";

const MIN_PLAYERS = 2;

const Lobby = () => {
  const { roomCode } = useParams();
  const {
    playersList,
    joinRoom,
    isConnected,
    removePlayer,
    notification,
    startGame,
    gameData,
    gameConfig,
    setGameConfig,
  } = useSocket();
  const navigate = useNavigate();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [playerID, setPlayerID] = useState("");

  const currentPlayer = playersList.find((p) => p.id === playerID);
  const isHost = currentPlayer?.host ?? false;
  const canStart = isHost && playersList.length >= MIN_PLAYERS;

  // Navigate to game when game starts
  useEffect(() => {
    if (gameData && roomCode) {
      navigate(`/game/${roomCode}`);
    }
  }, [gameData, roomCode, navigate]);

  useEffect(() => {
    if (!isConnected || !roomCode || isJoining) return;

    const savedName = localStorage.getItem("playerName");
    const playerId = localStorage.getItem("playerId");
    const isAlreadyInList = playersList.some((p) => p.id === playerId);

    setPlayerID(playerId || "");

    if (!isAlreadyInList && savedName) {
      setIsJoining(true);
      joinRoom(savedName, roomCode);
    } else if (!isAlreadyInList && !savedName) {
      setShowJoinModal(true);
    } else if (isAlreadyInList) {
      setIsJoining(false);
      setShowJoinModal(false);
    }
  }, [playersList, roomCode, joinRoom, isConnected, isJoining]);

  const handleJoinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (nameInput.trim() && roomCode && !isJoining) {
      setIsJoining(true);
      joinRoom(nameInput.trim(), roomCode);
      setShowJoinModal(false);
    }
  };

  return (
    <div className="lobby">
      {notification && (
        <div className="lobby__toast" key={notification}>
          {notification}
        </div>
      )}

      <h1>El Impostor</h1>

      <div className="lobby__room-card">
        <p className="lobby__room-label">Código de sala</p>
        <p className="lobby__room-code">{roomCode}</p>
      </div>

      <div className="lobby__status">
        <div className="spinner" />
        <span>Esperando jugadores ({playersList.length})</span>
      </div>

      <ul className="lobby__players">
        {playersList.map((player) => {
          const isSelf = player.id === playerID;
          const initials = player.name.slice(0, 2).toUpperCase();
          return (
            <li
              key={player.id}
              className={`lobby__player${isSelf ? " lobby__player--self" : ""}`}
            >
              <div className="lobby__player-avatar">{initials}</div>
              <span className="lobby__player-name">{player.name}</span>
              <div className="lobby__player-badges">
                {player.host && (
                  <span className="lobby__badge lobby__badge--host">Host</span>
                )}
                {isSelf && (
                  <span className="lobby__badge lobby__badge--self">Vos</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isHost && (
        <div className="lobby__config">
          <p className="lobby__config-title">Configuración</p>

          <div className="lobby__config-item">
            <span className="lobby__config-label">Impostores</span>
            <div className="stepper">
              <button
                className="stepper__btn"
                onClick={() =>
                  setGameConfig({
                    ...gameConfig,
                    impostorCount: Math.max(1, gameConfig.impostorCount - 1),
                  })
                }
                disabled={gameConfig.impostorCount <= 1}
              >
                −
              </button>
              <span className="stepper__val">{gameConfig.impostorCount}</span>
              <button
                className="stepper__btn"
                onClick={() =>
                  setGameConfig({
                    ...gameConfig,
                    impostorCount: Math.min(
                      Math.max(1, playersList.length - 1),
                      gameConfig.impostorCount + 1
                    ),
                  })
                }
                disabled={gameConfig.impostorCount >= Math.max(1, playersList.length - 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="lobby__config-item">
            <span className="lobby__config-label">Mostrar pistas al impostor</span>
            <button
              className={`toggle${gameConfig.showImpostorWords ? " toggle--on" : ""}`}
              onClick={() =>
                setGameConfig({
                  ...gameConfig,
                  showImpostorWords: !gameConfig.showImpostorWords,
                })
              }
              role="switch"
              aria-checked={gameConfig.showImpostorWords}
            >
              <span className="toggle__thumb" />
            </button>
          </div>
        </div>
      )}

      <div className="lobby__actions">
        {isHost ? (
          <button
            className={`btn btn--primary${canStart ? "" : " btn--disabled"}`}
            disabled={!canStart}
            onClick={startGame}
            title={!canStart ? `Se necesitan al menos ${MIN_PLAYERS} jugadores` : undefined}
          >
            Jugar
          </button>
        ) : (
          <p className="lobby__waiting-host">Esperando que el host inicie el juego…</p>
        )}
        <button className="btn btn--danger" onClick={() => setShowLeaveModal(true)}>
          Salir de Sala
        </button>
      </div>

      {showJoinModal && (
        <Modal>
          <h3 className="modal__title">¡Hola!</h3>
          <p className="modal__text">Ingresá tu nombre para jugar</p>
          <form className="modal__form" onSubmit={handleJoinSubmit}>
            <input
              autoFocus
              type="text"
              className="input"
              value={nameInput}
              maxLength={30}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Tu nombre..."
            />
            <button type="submit" className="btn btn--primary">
              Unirse
            </button>
          </form>
        </Modal>
      )}

      {showLeaveModal && (
        <Modal>
          <h3 className="modal__title">¿Salir de la sala?</h3>
          <p className="modal__text">Vas a abandonar la partida.</p>
          <div className="modal__actions">
            <button
              className="btn btn--danger"
              onClick={() => {
                if (roomCode) removePlayer(playerID, roomCode);
                setShowLeaveModal(false);
                navigate("/");
              }}
            >
              Sí, salir
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setShowLeaveModal(false)}
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Lobby;
