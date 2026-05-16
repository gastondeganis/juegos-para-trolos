import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import type { GameData, Player } from "../../types";
import "./Game.css";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

// ──────────────────────────────────────────────────────────────
// Sub-views
// ──────────────────────────────────────────────────────────────

/** READY / WORD_PICKING — first player picks the word */
function WordPickView({
  isFirstPlayer,
  onPick,
}: {
  isFirstPlayer: boolean;
  onPick: (data: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"idle" | "custom">("idle");
  const [realWord, setRealWord] = useState("");
  const [impostorWords, setImpostorWords] = useState("");

  const handleRandom = () => onPick({ random: true });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rw = realWord.trim().slice(0, 60);
    const iw = impostorWords
      .split(",")
      .map((w) => w.trim().slice(0, 60))
      .filter(Boolean);
    if (!rw || iw.length === 0) return;
    onPick({ random: false, input_word: rw, input_impostor_words: iw });
  };

  if (!isFirstPlayer) {
    return (
      <div className="game-view game-view--center">
        <div className="spinner" />
        <p className="game-muted">El primer jugador está eligiendo la palabra…</p>
      </div>
    );
  }

  return (
    <div className="game-view">
      <h2>Elegí la palabra</h2>
      <p className="game-muted">Solo vos podés verla ahora.</p>

      {mode === "idle" && (
        <div className="game-view__actions">
          <button className="btn btn--primary" onClick={handleRandom}>
            Palabra aleatoria
          </button>
          <button className="btn btn--ghost" onClick={() => setMode("custom")}>
            Palabra personalizada
          </button>
        </div>
      )}

      {mode === "custom" && (
        <form className="game-form" onSubmit={handleCustomSubmit}>
          <label className="game-label">
            Palabra real
            <input
              className="input"
              type="text"
              maxLength={60}
              placeholder="ej: Pizza"
              value={realWord}
              onChange={(e) => setRealWord(e.target.value)}
              autoFocus
            />
          </label>
          <label className="game-label">
            Palabras del impostor <span className="game-muted">(separadas por coma)</span>
            <input
              className="input"
              type="text"
              maxLength={200}
              placeholder="ej: Hamburguesa, Milanesa"
              value={impostorWords}
              onChange={(e) => setImpostorWords(e.target.value)}
            />
          </label>
          <div className="game-view__actions">
            <button type="submit" className="btn btn--primary">
              Confirmar
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setMode("idle")}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** AWAITING_ACK — everyone sees their word and must confirm */
function WordRevealView({
  gameData,
  onAck,
}: {
  gameData: GameData;
  onAck: () => void;
}) {
  const isImpostor = gameData.player_role === "impostor";
  const hasAcked = gameData.player_ack;

  return (
    <div className="game-view game-view--center">
      <div className={`role-badge role-badge--${gameData.player_role}`}>
        {isImpostor ? "Impostor" : "Civil"}
      </div>

      <div className="word-card">
        <p className="word-card__label">Tu palabra</p>
        {gameData.word.map((w, i) => (
          <p key={i} className="word-card__word">
            {w}
          </p>
        ))}
        {isImpostor && (
          <p className="game-muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
            Puede haber varias variantes para confundirte
          </p>
        )}
      </div>

      <p className="game-muted">
        Memorizá tu palabra. No la digas directamente.
      </p>

      {!hasAcked ? (
        <button className="btn btn--primary" onClick={onAck}>
          Entendido
        </button>
      ) : (
        <p className="game-muted">Esperando que todos confirmen…</p>
      )}
    </div>
  );
}

/** IN_PROGRESS — discussion phase */
function DiscussionView({
  gameData,
  players,
  myID,
  onStartVoting,
}: {
  gameData: GameData;
  players: Player[];
  myID: string;
  onStartVoting: () => void;
}) {
  const isImpostor = gameData.player_role === "impostor";
  const activePlayers = players.filter((p) =>
    gameData.active_player_ids.includes(p.id)
  );

  return (
    <div className="game-view">
      <div className={`role-badge role-badge--${gameData.player_role}`}>
        {isImpostor ? "Impostor" : "Civil"}
      </div>

      <div className="word-card word-card--sm">
        <p className="word-card__label">Tu palabra</p>
        {gameData.word.map((w, i) => (
          <p key={i} className="word-card__word word-card__word--sm">
            {w}
          </p>
        ))}
      </div>

      <div className="game-section">
        <h3>Jugadores activos</h3>
        <ul className="game-player-list">
          {activePlayers.map((p) => (
            <li key={p.id} className={`game-player${p.id === myID ? " game-player--self" : ""}`}>
              <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
              <span>{p.name}</span>
              {p.id === myID && <span className="pill">Vos</span>}
              {p.host && <span className="pill pill--host">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {gameData.is_first_player && (
        <button className="btn btn--primary" onClick={onStartVoting}>
          Iniciar votación
        </button>
      )}
      {!gameData.is_first_player && (
        <p className="game-muted">Discutan e intenten descubrir al impostor.</p>
      )}
    </div>
  );
}

/** VOTING — click a player to vote */
function VotingView({
  gameData,
  players,
  myID,
  onVote,
  onCloseElection,
}: {
  gameData: GameData;
  players: Player[];
  myID: string;
  onVote: (targetID: string) => void;
  onCloseElection: () => void;
}) {
  const activePlayers = players.filter(
    (p) => gameData.active_player_ids.includes(p.id) && p.id !== myID
  );
  const totalVotes = Object.values(gameData.players_votes ?? {}).reduce((a, b) => a + b, 0);
  const allVoted = totalVotes >= activePlayers.length;

  return (
    <div className="game-view">
      <h2>Votación</h2>
      <p className="game-muted">¿Quién creés que es el impostor?</p>

      <ul className="game-player-list game-player-list--vote">
        {activePlayers.map((p) => {
          const votes = gameData.players_votes?.[p.id] ?? 0;
          return (
            <li key={p.id} className="game-player game-player--vote">
              <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
              <span className="game-player__name">{p.name}</span>
              {votes > 0 && (
                <span className="vote-count">{votes} {votes === 1 ? "voto" : "votos"}</span>
              )}
              {!gameData.player_voted && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => onVote(p.id)}
                >
                  Votar
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {gameData.player_voted && (
        <p className="game-muted">Ya votaste. Esperando al resto…</p>
      )}

      {gameData.is_first_player && (
        <button
          className={`btn btn--danger${allVoted ? "" : " btn--ghost"}`}
          onClick={onCloseElection}
        >
          Cerrar votación
        </button>
      )}
    </div>
  );
}

/** SHOWING_RESULTS / SHOWING_RESULTS_DELETE — results of the vote */
function ResultsView({
  gameData,
  players,
  isFirstPlayer,
  onNextRound,
  onRestart,
}: {
  gameData: GameData;
  players: Player[];
  isFirstPlayer: boolean;
  onNextRound: () => void;
  onRestart: () => void;
}) {
  const isDraw = gameData.game_state === "showing_results" && gameData.eliminated_player_ids.length > 1;
  const hasContinue = gameData.game_state === "showing_results_delete";

  return (
    <div className="game-view game-view--center">
      <h2>Resultado de la votación</h2>

      {isDraw && (
        <>
          <div className="result-icon result-icon--draw">⚖️</div>
          <p className="game-muted">¡Empate! Nadie fue eliminado.</p>
          {isFirstPlayer && (
            <button className="btn btn--primary" onClick={onRestart}>
              Nueva partida
            </button>
          )}
        </>
      )}

      {!isDraw && gameData.eliminated_player_ids.length > 0 && (
        <>
          <div className="result-icon result-icon--eliminated">💀</div>
          <p className="game-eliminated">
            {playerName(players, gameData.eliminated_player_ids[0])} fue eliminado
          </p>
          {hasContinue && isFirstPlayer && (
            <button className="btn btn--primary" onClick={onNextRound}>
              Siguiente ronda
            </button>
          )}
          {hasContinue && !isFirstPlayer && (
            <p className="game-muted">Esperando al primer jugador…</p>
          )}
        </>
      )}

      {gameData.eliminated_player_ids.length === 0 && (
        <p className="game-muted">Calculando resultados…</p>
      )}
    </div>
  );
}

/** FINISH — game over */
function EndView({
  gameData,
  players,
  myID,
  onRestart,
}: {
  gameData: GameData;
  players: Player[];
  myID: string;
  onRestart: () => void;
}) {
  const civilWon = gameData.game_state === "finish_civil_victory";
  const iWon =
    (civilWon && gameData.player_role === "civil") ||
    (!civilWon && gameData.player_role === "impostor");

  return (
    <div className="game-view game-view--center">
      <div className={`end-icon${iWon ? " end-icon--win" : " end-icon--lose"}`}>
        {iWon ? "🎉" : "😢"}
      </div>
      <h2 className={iWon ? "end-title--win" : "end-title--lose"}>
        {iWon ? "¡Ganaste!" : "Perdiste"}
      </h2>
      <p className="game-muted">
        {civilWon ? "Los civiles descubrieron al impostor." : "El impostor sobrevivió."}
      </p>

      <div className="game-section">
        <h3>Roles revelados</h3>
        <ul className="game-player-list">
          {players.map((p) => (
            <li key={p.id} className={`game-player${p.id === myID ? " game-player--self" : ""}`}>
              <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
              <span>{p.name}</span>
              {p.id === myID && <span className="pill">Vos</span>}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn btn--primary" onClick={onRestart}>
        Jugar de nuevo
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Game page
// ──────────────────────────────────────────────────────────────

const Game = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { gameData, playersList, isConnected, joinRoom, sendGameEvent, notification } = useSocket();

  const [playerID] = useState(() => localStorage.getItem("playerId") ?? "");
  const [localPickingWord, setLocalPickingWord] = useState(false);

  // Reconnect: re-join the room if disconnected and reconnected
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    const savedName = localStorage.getItem("playerName");
    const isInList = playersList.some((p) => p.id === playerID);
    if (!isInList && savedName) {
      joinRoom(savedName, roomCode);
    }
  }, [isConnected, roomCode, playersList, playerID, joinRoom]);

  // If no game in progress and not reconnecting, go back to lobby
  useEffect(() => {
    if (!gameData && isConnected && playersList.length > 0) {
      navigate(`/lobby/${roomCode}`);
    }
  }, [gameData, isConnected, playersList, roomCode, navigate]);

  // Reset localPickingWord when server acknowledges word_picking or later states
  useEffect(() => {
    if (!gameData) return;
    const s = gameData.game_state;
    if (s === "awaiting_ack" || s === "in_progress" || s === "voting") {
      setLocalPickingWord(false);
    }
  }, [gameData]);

  if (!gameData) {
    return (
      <div className="game-page game-page--loading">
        <div className="spinner" />
        <p className="game-muted">Conectando al juego…</p>
      </div>
    );
  }

  const state = gameData.game_state;
  const isFirstPlayer = gameData.is_first_player;

  const handlePick = (data: Record<string, unknown>) => {
    sendGameEvent("word_choice", data);
  };

  const handleWordAccepted = () => sendGameEvent("word_accepted", {});
  const handlePlayerAcked = () => sendGameEvent("player_acked", { acked: true });

  const handleStartVoting = () => sendGameEvent("start_voting", {});

  const handleVote = (targetID: string) =>
    sendGameEvent("player_voted", { voted: true, voted_player_id: targetID });

  const handleCloseElection = () => sendGameEvent("election_closed", {});

  const handleRestart = () => sendGameEvent("restart_game", {});

  const handleNextRound = () => setLocalPickingWord(true);

  // State → view routing
  const showWordPicker =
    state === "ready" ||
    state === "word_picking" ||
    (state === "showing_results_delete" && localPickingWord);

  return (
    <div className="game-page">
      {notification && (
        <div className="game-toast">{notification}</div>
      )}

      <div className="game-header">
        <span className="game-room-code">{roomCode}</span>
      </div>

      {(state === "preparation") && (
        <div className="game-view game-view--center">
          <div className="spinner" />
          <p className="game-muted">Preparando el juego…</p>
        </div>
      )}

      {showWordPicker && (
        <WordPickView isFirstPlayer={isFirstPlayer} onPick={handlePick} />
      )}

      {state === "awaiting_ack" && (
        <WordRevealView
          gameData={gameData}
          onAck={() => {
            handleWordAccepted();
            handlePlayerAcked();
          }}
        />
      )}

      {state === "in_progress" && (
        <DiscussionView
          gameData={gameData}
          players={playersList}
          myID={playerID}
          onStartVoting={handleStartVoting}
        />
      )}

      {state === "voting" && (
        <VotingView
          gameData={gameData}
          players={playersList}
          myID={playerID}
          onVote={handleVote}
          onCloseElection={handleCloseElection}
        />
      )}

      {(state === "showing_results" || state === "showing_results_delete") && !localPickingWord && (
        <ResultsView
          gameData={gameData}
          players={playersList}
          isFirstPlayer={isFirstPlayer}
          onNextRound={handleNextRound}
          onRestart={handleRestart}
        />
      )}

      {(state === "finish_civil_victory" || state === "finish_impostor_victory") && (
        <EndView
          gameData={gameData}
          players={playersList}
          myID={playerID}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};

export default Game;
