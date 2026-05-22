import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import type { GameData, GameState, Player, Role } from "../../types";
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

/** READY / WORD_PICKING — three modes based on state and role */
function WordPickView({
  gameState,
  isFirstPlayer,
  word,
  onPick,
  onAccept,
}: {
  gameState: GameState;
  isFirstPlayer: boolean;
  word: string[];
  onPick: (data: Record<string, unknown>) => void;
  onAccept: () => void;
}) {
  // Waiting: another player is picking or confirming
  if (!isFirstPlayer) {
    return (
      <div className="game-view game-view--center">
        <div className="spinner" />
        <p className="game-muted">
          {gameState === "word_picking"
            ? "El anfitrión está confirmando la palabra…"
            : "El anfitrión está eligiendo la palabra…"}
        </p>
      </div>
    );
  }

  // Preview: word already sent, first player confirms or re-picks
  if (gameState === "word_picking") {
    return (
      <div className="game-view game-view--center">
        <p className="game-muted">La palabra para esta ronda:</p>
        <div className="word-card">
          <p className="word-card__label">Palabra</p>
          {word.map((w, i) => (
            <p key={i} className="word-card__word">{w}</p>
          ))}
        </div>
        <div className="game-view__actions">
          <button className="btn btn--primary" onClick={onAccept}>
            Confirmar
          </button>
          <button className="btn btn--ghost" onClick={() => onPick({ random: true })}>
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  // Pick: first player selects a word (state === "ready")
  return <WordPickForm onPick={onPick} />;
}

function WordPickForm({ onPick }: { onPick: (data: Record<string, unknown>) => void }) {
  const [mode, setMode] = useState<"idle" | "custom">("idle");
  const [realWord, setRealWord] = useState("");
  const [impostorWords, setImpostorWords] = useState("");

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

  return (
    <div className="game-view">
      <h2>Elegí la palabra</h2>
      <p className="game-muted">Solo vos podés verla ahora.</p>

      {mode === "idle" && (
        <div className="game-view__actions">
          <button className="btn btn--primary" onClick={() => onPick({ random: true })}>
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

/** AWAITING_ACK — press-and-hold to reveal word privately, then confirm */
function WordRevealView({
  gameData,
  players,
  onAck,
}: {
  gameData: GameData;
  players: Player[];
  onAck: () => void;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);

  const handlePressStart = () => {
    setIsRevealed(true);
    setHasRevealed(true);
  };
  const handlePressEnd = () => setIsRevealed(false);

  const isImpostor = gameData.player_role === "impostor";
  const hasAcked = gameData.player_ack;
  const acksMap = gameData.all_players_ack ?? {};
  const ackedCount = Object.values(acksMap).filter(Boolean).length;
  const hasWords = gameData.word && gameData.word.length > 0;

  return (
    <div className="game-view game-view--center">
      <div className="reveal-container">
        {isRevealed ? (
          <>
            <div className={`role-badge role-badge--${gameData.player_role}`}>
              {isImpostor ? "Impostor" : "Civil"}
            </div>
            <div className="word-card">
              <p className="word-card__label">
                {isImpostor ? "Tus pistas" : "Tu palabra"}
              </p>
              {hasWords ? (
                gameData.word.map((w, i) => (
                  <p key={i} className="word-card__word">{w}</p>
                ))
              ) : (
                <p className="word-card__word word-card__word--hint">
                  {isImpostor ? "Sin pistas 🕵️" : "???"}
                </p>
              )}
            </div>
            <p className="game-muted reveal-hint-text">
              {isImpostor
                ? "No reveles que sos el impostor"
                : "No digas tu palabra directamente"}
            </p>
          </>
        ) : (
          <div className="reveal-placeholder">
            <div className="reveal-placeholder__icon">🔒</div>
            <p className="game-muted">
              {hasRevealed ? "Palabra oculta" : "Mirá tu palabra en privado"}
            </p>
          </div>
        )}
      </div>

      <button
        className={`btn btn--reveal${isRevealed ? " btn--reveal--active" : ""}`}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isRevealed ? "Soltá para ocultar" : "👁 Mantené para ver"}
      </button>

      {hasRevealed && !hasAcked && (
        <button className="btn btn--primary" onClick={onAck}>
          Entendido
        </button>
      )}
      {hasAcked && <p className="game-muted">Ya confirmaste ✓</p>}

      <div className="game-section">
        <h3>Confirmados ({ackedCount}/{players.length})</h3>
        <ul className="game-player-list">
          {players.map((p) => {
            const acked = acksMap[p.id] ?? false;
            return (
              <li key={p.id} className="game-player">
                <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
                <span className="game-player__name">{p.name}</span>
                <span className={`ack-status${acked ? " ack-status--done" : ""}`}>
                  {acked ? "✓" : "⏳"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
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
  const word = gameData.word ?? [];
  const firstPlayer = players.find((p) => p.id === gameData.first_player_id);
  const firstPlayerName = firstPlayer?.name ?? "El anfitrión";

  return (
    <div className="game-view">
      <div className={`role-badge role-badge--${gameData.player_role}`}>
        {isImpostor ? "Impostor" : "Civil"}
      </div>

      <div className="word-card word-card--sm">
        <p className="word-card__label">Tu palabra</p>
        {word.length > 0 ? (
          word.map((w, i) => (
            <p key={i} className="word-card__word word-card__word--sm">{w}</p>
          ))
        ) : (
          <p className="word-card__word word-card__word--sm" style={{ color: "var(--text-muted)" }}>
            Sin pistas
          </p>
        )}
      </div>

      <div className="game-section">
        <h3>Jugadores activos</h3>
        <ul className="game-player-list">
          {activePlayers.map((p) => (
            <li key={p.id} className={`game-player${p.id === myID ? " game-player--self" : ""}`}>
              <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
              <span className="game-player__name">{p.name}</span>
              {p.id === myID && <span className="pill">Vos</span>}
              {p.id === gameData.first_player_id && <span className="pill pill--leader">Líder</span>}
            </li>
          ))}
        </ul>
      </div>

      {gameData.is_first_player ? (
        <button className="btn btn--primary" onClick={onStartVoting}>
          Iniciar votación
        </button>
      ) : (
        <div className="discussion-info">
          <p className="discussion-info__leader">
            Conduce la ronda: <strong>{firstPlayerName}</strong>
          </p>
          <p className="game-muted">
            Cuando terminen de discutir, {firstPlayerName} iniciará la votación.
          </p>
        </div>
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
  const activeCount = players.filter((p) =>
    gameData.active_player_ids.includes(p.id)
  ).length;
  const totalVotes = Object.values(gameData.players_votes ?? {}).reduce((a, b) => a + b, 0);
  const allVoted = totalVotes >= activeCount;

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
                <span className="vote-count">
                  {votes} {votes === 1 ? "voto" : "votos"}
                </span>
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
          className={`btn${allVoted ? " btn--danger" : " btn--ghost"}`}
          onClick={onCloseElection}
        >
          Cerrar votación
        </button>
      )}
    </div>
  );
}

/** SHOWING_RESULTS_DELETE / SHOWING_RESULTS_DRAW — round result */
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
  const isDraw = gameData.game_state === "showing_results_draw";
  const hasContinue = gameData.game_state === "showing_results_delete";

  return (
    <div className="game-view game-view--center">
      <h2>Resultado de la votación</h2>

      {isDraw && (
        <>
          <div className="result-icon">⚖️</div>
          <p className="game-eliminated">¡Empate!</p>
          <p className="game-muted">Nadie fue eliminado. El juego termina.</p>
          {isFirstPlayer ? (
            <button className="btn btn--primary" onClick={onRestart}>
              Nueva partida
            </button>
          ) : (
            <p className="game-muted">Esperando al anfitrión…</p>
          )}
        </>
      )}

      {!isDraw && gameData.eliminated_player_ids.length > 0 && (
        <>
          <div className="result-icon">💀</div>
          <p className="game-eliminated">
            {playerName(players, gameData.eliminated_player_ids[0])} fue eliminado
          </p>
          {hasContinue && isFirstPlayer && (
            <button className="btn btn--primary" onClick={onNextRound}>
              Siguiente ronda
            </button>
          )}
          {hasContinue && !isFirstPlayer && (
            <p className="game-muted">Esperando al anfitrión…</p>
          )}
        </>
      )}

      {!isDraw && gameData.eliminated_player_ids.length === 0 && (
        <p className="game-muted">Calculando resultados…</p>
      )}
    </div>
  );
}

/** FINISH_CIVIL_VICTORY / FINISH_IMPOSTOR_VICTORY — game over */
function EndView({
  gameData,
  players,
  myID,
  onRestart,
  onGoToMenu,
}: {
  gameData: GameData;
  players: Player[];
  myID: string;
  onRestart: () => void;
  onGoToMenu: () => void;
}) {
  const civilWon = gameData.game_state === "finish_civil_victory";
  const iWon =
    (civilWon && gameData.player_role === "civil") ||
    (!civilWon && gameData.player_role === "impostor");
  const rolesMap = gameData.all_players_roles;

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
          {players.map((p) => {
            const role = rolesMap?.[p.id] as Role | undefined;
            return (
              <li key={p.id} className={`game-player${p.id === myID ? " game-player--self" : ""}`}>
                <div className="game-player__avatar">{p.name.slice(0, 2).toUpperCase()}</div>
                <span className="game-player__name">{p.name}</span>
                {p.id === myID && <span className="pill">Vos</span>}
                {role && (
                  <span className={`role-badge role-badge--${role} role-badge--sm`}>
                    {role === "civil" ? "Civil" : "Impostor"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="game-view__actions">
        <button className="btn btn--primary" onClick={onRestart}>
          Jugar de nuevo
        </button>
        <button className="btn btn--ghost" onClick={onGoToMenu}>
          Ir al menú
        </button>
      </div>
    </div>
  );
}

/** GAME_FINISHED — terminal, no more plays */
function GameFinishedView({ onGoToMenu }: { onGoToMenu: () => void }) {
  return (
    <div className="game-view game-view--center">
      <div className="end-icon">🏁</div>
      <h2>Juego terminado</h2>
      <p className="game-muted">Gracias por jugar.</p>
      <button className="btn btn--primary" onClick={onGoToMenu}>
        Ir al menú
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
  const {
    gameData,
    playersList,
    isConnected,
    joinRoom,
    sendGameEvent,
    removePlayer,
    errorMessage,
    clearError,
    notification,
  } = useSocket();

  const [playerID] = useState(() => localStorage.getItem("playerId") ?? "");
  const hasAttemptedJoinRef = useRef(false);

  // Reset join flag whenever socket disconnects so we retry on next reconnect
  useEffect(() => {
    if (!isConnected) hasAttemptedJoinRef.current = false;
  }, [isConnected]);

  // Attempt to rejoin once per connection — avoids infinite loop caused by
  // joinRoom resetting playersList which would re-trigger this effect
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    if (hasAttemptedJoinRef.current) return;
    const savedName = localStorage.getItem("playerName");
    const isInList = playersList.some((p) => p.id === playerID);
    if (!isInList && savedName) {
      hasAttemptedJoinRef.current = true;
      joinRoom(savedName, roomCode);
    }
  }, [isConnected, roomCode, playersList, playerID, joinRoom]);

  // Room not found or join error → go home
  useEffect(() => {
    if (errorMessage) {
      clearError();
      navigate("/");
    }
  }, [errorMessage, clearError, navigate]);

  // If connected and confirmed in the room but no game state arrives within 2s,
  // assume the game hasn't started yet and go back to lobby.
  // The timeout is cancelled if gameData arrives (normal reconnect case).
  useEffect(() => {
    if (gameData || !isConnected) return;
    const isInRoom = playersList.some((p) => p.id === playerID);
    if (!isInRoom) return;
    const t = setTimeout(() => navigate(`/lobby/${roomCode}`), 2000);
    return () => clearTimeout(t);
  }, [gameData, isConnected, playersList, playerID, roomCode, navigate]);

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

  const handlePick = (data: Record<string, unknown>) =>
    sendGameEvent("word_choice", data);
  const handleWordAccepted = () => sendGameEvent("word_accepted", {});
  const handlePlayerAcked = () => sendGameEvent("player_acked", { acked: true });
  const handleStartVoting = () => sendGameEvent("start_voting", {});
  const handleVote = (targetID: string) =>
    sendGameEvent("player_voted", { voted: true, voted_player_id: targetID });
  const handleCloseElection = () => sendGameEvent("election_closed", {});
  const handleRestart = () => sendGameEvent("restart_game", {});
  const handleNextRound = () => sendGameEvent("word_choice", { random: true });
  const handleGoToMenu = () => {
    if (roomCode) removePlayer(playerID, roomCode);
    navigate("/");
  };

  const showWordPicker = state === "ready" || state === "word_picking";

  return (
    <div className="game-page">
      {notification && <div className="game-toast">{notification}</div>}

      <div className="game-header">
        <span className="game-room-code">{roomCode}</span>
      </div>

      {state === "preparation" && (
        <div className="game-view game-view--center">
          <div className="spinner" />
          <p className="game-muted">Preparando el juego…</p>
        </div>
      )}

      {showWordPicker && (
        <WordPickView
          gameState={state}
          isFirstPlayer={isFirstPlayer}
          word={gameData.word ?? []}
          onPick={handlePick}
          onAccept={handleWordAccepted}
        />
      )}

      {state === "awaiting_ack" && (
        <WordRevealView
          gameData={gameData}
          players={playersList}
          onAck={handlePlayerAcked}
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

      {(state === "showing_results_draw" || state === "showing_results_delete") && (
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
          onGoToMenu={handleGoToMenu}
        />
      )}

      {state === "game_finished" && (
        <GameFinishedView onGoToMenu={handleGoToMenu} />
      )}
    </div>
  );
};

export default Game;
