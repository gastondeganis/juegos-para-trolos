# RFC: Arquitectura Frontend para "El Impostor"

**Estado:** Draft  
**Fecha:** 2026-05-16  
**Autor:** Gastón De Ganis

---

## 1. Resumen ejecutivo

Este RFC define el contrato entre el frontend React y el backend Go para el juego "El Impostor". El frontend debe ser una **pantalla boba** (dumb client): nunca calcula quién ganó, si hay empate, o cuántos ACKs faltan — solo recibe `game_state_updated` y renderiza la UI correspondiente. Todo el peso algorítmico corre del lado de Go.

---

## 2. Estado actual del backend (contrato WS)

### 2.1 Eventos Client → Server

| Evento | Payload | Estado requerido | Restricción |
|---|---|---|---|
| `create_room` | `{ host, host_id }` | — | — |
| `player_joined` | `{ player_name, player_id, room_code }` | — | — |
| `start_game` | `{}` | WAITING | Solo host |
| `player_left` | `{ player_id, room_code }` | — | — |
| `word_choice` | `{ random, category?, input_word?, input_impostor_words?, add_input_word? }` | `ready` ó `word_picking` | Solo primer jugador (ver §4.1) |
| `word_accepted` | `{}` | `word_picking` | Solo primer jugador |
| `player_acked` | `{ acked: bool }` | `awaiting_ack` | Cualquier jugador |
| `start_voting` | `{}` | `in_progress` | Solo primer jugador |
| `player_voted` | `{ voted: bool, voted_player_id: string }` | `voting` | No puede votar a sí mismo |
| `election_closed` | `{}` | `voting` | Solo primer jugador |
| `restart_game` | `{}` | estados terminales | Cualquier jugador |
| `ping` | `{}` | — | Keepalive cada 30s |

### 2.2 Eventos Server → Client

| Evento | Payload | Cuándo |
|---|---|---|
| `room_created` | `{ room_code, players[] }` | Host crea sala |
| `room_joined` | `{ room_code }` | Jugador se une |
| `players_updated` | `{ room_code, players[] }` | Entra/sale un jugador |
| `game_state_updated` | `DataResponse` (por jugador) | Cualquier cambio de estado |
| `room_not_found` | `{ message }` | — |
| `player_joined_error` | `{ message }` | — |
| `pong` | `{}` | Respuesta a ping |

### 2.3 Máquina de estados del backend

```
                    start_game
  WAITING ────────────────────────► GAME_READY (preparation → ready)
                                         │
                              word_choice (primer jugador)
                                         │
                                         ▼
                                   WORD_PICKING
                                         │
                              word_accepted (primer jugador)
                                         │
                                         ▼
                                   AWAITING_ACK
                                         │
                              todos player_acked
                                         │
                                         ▼
                                    IN_PROGRESS ◄──────────────────────┐
                                         │                              │
                              start_voting (primer jugador)             │
                                         │                              │
                                         ▼                              │
                                      VOTING                            │
                                         │                              │
                              election_closed (primer jugador)          │
                                         │                              │
                                         ▼                              │
                               CALCULATING_RESULTS                      │
                                         │                              │
                    ┌────────────────────┼────────────────────┐         │
                    ▼                    ▼                    ▼         │
          SHOWING_RESULT_CONTINUE  SHOWING_RESULT_DRAW  (continúa)     │
          (1 eliminado, sigue)     (empate, termina)                    │
                    │                                                    │
                    └────────────────────────────────────────────────────┘
                              word_choice (siguiente ronda)
                              
                                FINISH_CIVIL_VICTORY
                                FINISH_IMPOSTOR_VICTORY
```

> **Nota:** `restart_game` aplica a `FINISH_CIVIL_VICTORY`, `FINISH_IMPOSTOR_VICTORY` y `SHOWING_RESULT_DRAW` (reinicia con los mismos jugadores).

### 2.4 Estructura de `DataResponse` (actual)

El evento `game_state_updated` tiene esta forma:

```json
{
  "event": "game_state_updated",
  "data": {
    "GameState": "awaiting_ack",
    "player_role": "civil",
    "player_ack": false,
    "player_voted": false,
    "word": ["perro"],
    "players_votes": { "id1": 0, "id2": 1 }
  }
}
```

---

## 3. Gaps entre backend y necesidades del frontend

Esta sección documenta qué datos necesita la UI que el backend **aún no envía**.

### 3.1 Bug: `GameState` sin tag JSON

```go
// ACTUAL — serializa como "GameState" (PascalCase)
type DataResponse struct {
    GameState    game.GameState
    PlayerRole   Role   `json:"player_role"`
    ...
}
```

**Impacto:** El frontend recibe `"GameState"` con G mayúscula, inconsistente con el resto. Debe normalizarse en el backend.

**Fix requerido:**
```go
GameState game.GameState `json:"game_state"`
```

### 3.2 Falta: `is_first_player`

El frontend necesita saber si el jugador actual es el "primer jugador" para mostrarle los controles de host del juego (`word_choice`, `word_accepted`, `start_voting`, `election_closed`). Actualmente no viene en el payload.

**Fix requerido en `DataResponse`:**
```go
IsFirstPlayer bool `json:"is_first_player"`
```

**Lógica en `GetGameState`:**
```go
IsFirstPlayer: i.FirstPlayerID == playerID,
```

### 3.3 Falta: `all_players_ack`

La fase `AWAITING_ACK` debe mostrar un progreso de quién ya hizo ACK. Solo viene `player_ack` (el propio), no el mapa completo.

**Fix requerido:**
```go
AllPlayersAck map[string]bool `json:"all_players_ack"`
```

### 3.4 Falta: `players_to_delete` en el payload

El campo `PlayersToDelete` existe en el struct `Impostor` pero no se incluye en `GetGameState`. Es necesario para la fase de resultados (mostrar quién fue eliminado).

**Fix requerido en `GetGameState`:**
```go
PlayersToDelete: i.PlayersToDelete,
```

### 3.5 Falta: `all_players_roles` (solo en estados terminales)

En los estados finales (`FINISH_*`, `SHOWING_RESULT_DRAW`) hay que revelar quiénes eran los impostores. Solo enviarlo cuando el juego terminó para no spoilear.

**Fix requerido:**
```go
AllPlayersRoles map[string]string `json:"all_players_roles,omitempty"`

// Poblar solo en estados terminales:
if i.State == FINISH_CIVIL_VICTORY || i.State == FINISH_IMPOSTOR_VICTORY || i.State == SHOWING_RESULT_DRAW {
    allRoles[id] = string(gp.Role)
}
```

### 3.6 Falta: `active_players`

En la fase de votación, el frontend necesita saber qué jugadores siguen activos para mostrar solo a los disponibles para votar (los eliminados en rondas anteriores no deben aparecer).

**Fix requerido:**
```go
ActivePlayers []string `json:"active_players"`

// En GetGameState:
for id, gp := range i.Players {
    if gp.Active {
        activePlayers = append(activePlayers, id)
    }
}
```

### 3.7 Bug lógico: `wordChoice` no acepta `SHOWING_RESULT_CONTINUE`

Cuando un jugador es eliminado pero el juego continúa (`SHOWING_RESULT_CONTINUE`), el primer jugador necesita iniciar una nueva ronda con `word_choice`. Pero la validación actual solo acepta `GAME_READY` y `WORD_PICKING`.

**Fix requerido en `wordChoice`:**
```go
if !((i.State == GAME_READY) || (i.State == WORD_PICKING) || (i.State == SHOWING_RESULT_CONTINUE)) {
    return fmt.Errorf(...)
}
```

---

## 4. Arquitectura frontend propuesta

### 4.1 Principio fundamental

```
Backend = Única fuente de verdad
Frontend = Renderizador de estados
```

El cliente nunca deduce si hay empate, nunca cuenta votos, nunca decide transiciones. Solo reacciona al `game_state` recibido.

### 4.2 Mapa de estados → pantallas

| `game_state` (backend) | Pantalla frontend |
|---|---|
| `preparation`, `ready` | `WordPickingScreen` (primer jugador elige) |
| `word_picking` | `WordPickingScreen` (primer jugador preview, otros esperan) |
| `awaiting_ack` | `AwaitingAckScreen` |
| `in_progress` | `InProgressScreen` |
| `voting` | `VotingScreen` |
| `showing_results_delete` | `RoundResultScreen` (sigue la partida) |
| `showing_results` | `ResultsScreen` (empate — juego terminado) |
| `finish_civil_victory` | `ResultsScreen` (victoria civiles) |
| `finish_impostor_victory` | `ResultsScreen` (victoria impostores) |

### 4.3 Estructura de rutas

```
/                       → Home (crear/unirse)
/lobby/:roomCode        → Lobby (espera jugadores, host puede iniciar)
/game/:roomCode         → Game (controlador de fases)
```

La navegación `Lobby → Game` ocurre cuando `game_state_updated` llega por primera vez (cualquier estado ≠ null). La navegación `Game → Home` solo ocurre cuando el jugador hace clic en "Ir al menú".

### 4.4 Contexto del socket (SocketContext)

El contexto centraliza:
- La conexión WS (una sola instancia)
- La lista de jugadores (`playersList`) — persiste entre lobby y juego
- El estado del juego (`gameData: GameData | null`)
- Los métodos de envío de eventos

```typescript
interface SocketContextType {
  // Estado de sala
  socket: WebSocket | null;
  isConnected: boolean;
  roomCode: string;
  playersList: Player[];
  
  // Estado del juego (null = en lobby)
  gameData: GameData | null;
  
  // Mensajes de sala
  errorMessage: string;
  notification: string;
  
  // Acciones de sala
  createRoom: (name: string) => void;
  joinRoom: (name: string, code: string) => void;
  removePlayer: (playerID: string, roomCode: string) => void;
  clearError: () => void;
  
  // Acciones del juego
  startGame: () => void;
  sendWordChoice: (data: WordChoicePayload) => void;
  acceptWord: () => void;
  ackWord: () => void;
  startVoting: () => void;
  votePlayer: (votedPlayerId: string) => void;
  closeElection: () => void;
  restartGame: () => void;
}
```

### 4.5 Tipos TypeScript del juego

```typescript
// types/index.ts

export type Player = {
  id: string;
  name: string;
  host: boolean;
};

export type GamePhase =
  | "preparation"
  | "ready"
  | "word_picking"
  | "awaiting_ack"
  | "in_progress"
  | "voting"
  | "showing_results"         // empate (draw)
  | "showing_results_delete"  // un eliminado, continúa
  | "finish_civil_victory"
  | "finish_impostor_victory"
  | "game_finished";

export type PlayerRole = "civil" | "impostor";

export type GameData = {
  game_state: GamePhase;
  player_role: PlayerRole;
  player_ack: boolean;
  player_voted: boolean;
  word: string[];                              // civil: [realWord], impostor: [fake1, fake2, ...]
  players_votes: Record<string, number>;       // playerID → cant. votos
  is_first_player: boolean;                    // puede disparar word_accepted, start_voting, election_closed
  players_to_delete: string[];                 // IDs de eliminados en la última ronda
  all_players_ack: Record<string, boolean>;    // para mostrar progreso de ACK
  all_players_roles: Record<string, PlayerRole> | null;  // null hasta estados terminales
  active_players: string[];                    // IDs de jugadores aún en juego
};

export type WordChoicePayload = {
  random: true;
  category?: string;
} | {
  random: false;
  input_word: string;
  input_impostor_words: string[];
};
```

---

## 5. Diseño de cada pantalla

### 5.1 WordPickingScreen (estados: `ready`, `word_picking`)

**Condición de render:** `game_state === "ready" || game_state === "word_picking"`

#### Vista: Primer jugador (`is_first_player === true`)

```
┌────────────────────────────────────┐
│       ¡Elegí la palabra!           │
│  Sos el anfitrión de esta ronda    │
│                                    │
│  [🎲 Palabra aleatoria]            │
│                                    │
│  ─── o escribí la tuya ────        │
│                                    │
│  Palabra real:  [___________]      │
│  Palabras impostora: [_______]     │
│  (separadas por coma)              │
│                                    │
│  [Usar esta palabra]               │
└────────────────────────────────────┘
```

Cuando `game_state === "word_picking"` (ya hay una palabra seleccionada):

```
┌────────────────────────────────────┐
│         Tu palabra es:             │
│                                    │
│         🐕  PERRO                  │
│                                    │
│  [✓ Aceptar]   [↩ Cambiar]        │
└────────────────────────────────────┘
```

- **"Aceptar"** → `sendEvent("word_accepted", {})`
- **"Cambiar"** → vuelve al formulario de selección (UI local, no envía nada)
- **"Palabra aleatoria"** → `sendEvent("word_choice", { random: true })`
- **"Usar esta palabra"** → `sendEvent("word_choice", { random: false, input_word: "...", input_impostor_words: [...] })`

#### Vista: Resto de jugadores (`is_first_player === false`)

```
┌────────────────────────────────────┐
│   [spinner]                        │
│   El anfitrión está eligiendo      │
│   la palabra de esta ronda...      │
└────────────────────────────────────┘
```

**Invariante:** Los jugadores que no son primer jugador **nunca ven** la palabra durante este estado, aunque `gameData.word` ya venga en el payload. La UI lo ignora.

---

### 5.2 AwaitingAckScreen (estado: `awaiting_ack`)

**Condición de render:** `game_state === "awaiting_ack"`

```
┌────────────────────────────────────┐
│         Tu palabra es:             │
│                                    │
│         🐕  PERRO          [CIVIL] │
│   (impostor: "Suprema", "Bife")    │
│                                    │
│   [✓ ¡Entendido!]  (si !acked)    │
│   [✓ Confirmado]   (si acked)      │
│                                    │
│   Jugadores listos:                │
│   • Gastón  ✓                      │
│   • Rami    ⏳                     │
│   • Juli    ✓                      │
└────────────────────────────────────┘
```

- **"¡Entendido!"** → `sendEvent("player_acked", { acked: true })`; botón desaparece (o se desactiva) cuando `player_ack === true`
- Lista de progreso: se construye cruzando `playersList` con `all_players_ack` (playerID → bool)
- El avance al siguiente estado lo hace el backend automáticamente cuando todos ackearon

**Invariante de seguridad:** Civil ve `word[0]`. Impostor ve todos sus `word[]`. El backend ya filtró esto.

---

### 5.3 InProgressScreen (estado: `in_progress`)

**Condición de render:** `game_state === "in_progress"`

```
┌────────────────────────────────────┐
│   🕵️  Fase de discusión            │
│                                    │
│   Tu palabra:  PERRO       [CIVIL] │
│                                    │
│   Debatí con el grupo.             │
│   Intentá descubrir al impostor.   │
│                                    │
│   ─────────────────────────────   │
│   [🗳 Iniciar Votación]            │
│   (solo visible si is_first_player) │
└────────────────────────────────────┘
```

- El botón "Iniciar Votación" solo se renderiza si `is_first_player === true`
- **"Iniciar Votación"** → `sendEvent("start_voting", {})`
- El resto de los jugadores no tiene controles, solo ven su palabra y la dinámica del juego

---

### 5.4 VotingScreen (estado: `voting`)

**Condición de render:** `game_state === "voting"`

```
┌────────────────────────────────────┐
│   🗳  Tiempo de votar              │
│                                    │
│   ¿Quién es el impostor?           │
│                                    │
│   ○ Rami        [3 votos]          │
│   ● Juli        [1 voto]   ← tuyo  │
│   ○ Pedro       [0 votos]          │
│                                    │
│   (No podés votarte a vos mismo)   │
│                                    │
│   [🔒 Cerrar Votación]             │
│   (solo si is_first_player)        │
└────────────────────────────────────┘
```

- Lista de jugadores: `active_players` cruzado con `playersList` (excluir al jugador propio con `localStorage.playerId`)
- Votos mostrados en tiempo real desde `players_votes`
- Jugador seleccionado resaltado si `PlayerVote[myID] === candidate`
- **Votar** → `sendEvent("player_voted", { voted: true, voted_player_id: "..." })`
- Se puede cambiar el voto enviando otro `player_voted` con diferente ID
- **"Cerrar Votación"** → `sendEvent("election_closed", {})` (solo `is_first_player`)

---

### 5.5 RoundResultScreen (estado: `showing_results_delete`)

**Condición de render:** `game_state === "showing_results_delete"`

```
┌────────────────────────────────────┐
│   📋  Resultado de la ronda        │
│                                    │
│   Jugador eliminado:               │
│   🚫 Rami                          │
│                                    │
│   Votos: Rami 3 | Juli 1 | ...    │
│                                    │
│   El juego continúa...             │
│                                    │
│   [▶ Siguiente ronda]              │
│   (solo si is_first_player)        │
│   Esperando al anfitrión...        │
│   (resto de jugadores)             │
└────────────────────────────────────┘
```

- Nombre del eliminado: cruzar `players_to_delete[0]` con `playersList`
- **No se revela el rol** del eliminado (el juego sigue, podría spoilear)
- **"Siguiente ronda"** → `sendEvent("word_choice", { random: true })` (el backend acepta esto desde `SHOWING_RESULT_CONTINUE` — requiere fix §3.7)
- El estado `showing_results_delete` es transitorio hacia una nueva ronda, no es fin de juego

---

### 5.6 ResultsScreen (estados: `finish_civil_victory`, `finish_impostor_victory`, `showing_results`)

**Condición de render:** `game_state` es uno de los tres terminales

#### Fin de juego — victoria civiles

```
┌────────────────────────────────────┐
│   🎉  ¡Ganaron los civiles!        │
│                                    │
│   Los impostores eran:             │
│   🕵️  Rami (Impostor)              │
│   🕵️  Pedro (Impostor)             │
│                                    │
│   Todos los jugadores:             │
│   • Gastón  → Civil   ✓           │
│   • Juli    → Civil   ✓           │
│   • Rami    → Impostor ✗          │
│                                    │
│   [🔄 Volver a jugar]              │
│   [🏠 Ir al menú]                  │
└────────────────────────────────────┘
```

#### Fin de juego — victoria impostores

Igual que arriba pero con texto "¡Ganaron los impostores!" y tonalidad de alerta.

#### Empate (`showing_results`)

```
┌────────────────────────────────────┐
│   🤝  ¡Empate!                     │
│                                    │
│   No hubo un ganador claro.        │
│   Los impostores eran:             │
│   🕵️  Rami                         │
│                                    │
│   [🔄 Volver a jugar]              │
│   [🏠 Ir al menú]                  │
└────────────────────────────────────┘
```

- Roles se muestran cruzando `all_players_roles` (solo disponible en estados terminales) con `playersList`
- **"Volver a jugar"** → `sendEvent("restart_game", {})` → todos reciben `game_state_updated` con estado `"ready"`; el contexto no navega, queda en `/game/:roomCode`
- **"Ir al menú"** → `sendEvent("player_left", { player_id, room_code })` + `navigate("/")`

---

## 6. Manejo del ciclo de vida y reconexión

### 6.1 Flujo de reconexión (jugador que recarga la página)

```
Jugador recarga /game/:roomCode
       │
       ▼
SocketContext se monta, abre WS
       │
       ▼
Envía player_joined (desde localStorage: playerId, playerName, roomCode)
       │
       ▼
Backend responde players_updated → playersList se actualiza
       │
       ▼
Backend NO envía automáticamente game_state_updated...
```

**Problema:** Al reconectarse, el backend no re-emite el estado actual del juego. El jugador queda en blanco.

**Solución propuesta:** Agregar un evento `sync_game_state` (client → server) que el cliente envíe al reconectarse si tiene un `roomCode` en la URL. El backend responde con el `game_state_updated` actual de ese jugador.

> Esta es una mejora futura; en la implementación inicial, el jugador reconectado necesitará refrescar el estado manualmente o el host reiniciará.

### 6.2 Keepalive

El contexto envía `ping` cada 30 segundos. El backend tiene un `ReadDeadline` de 60 segundos, por lo que el ping previene timeouts en partidas largas.

---

## 7. Cambios requeridos en el backend

Resumen de todos los cambios de Go necesarios para que el frontend funcione:

### 7.1 `impostor/types.go`

```go
type DataResponse struct {
    GameState       game.GameState      `json:"game_state"`        // fix: tag faltante
    PlayerRole      Role                `json:"player_role"`
    PlayerAck       bool                `json:"player_ack"`
    PlayerVoted     bool                `json:"player_voted"`
    Word            []string            `json:"word"`
    PlayersVotes    map[string]uint8    `json:"players_votes"`
    IsFirstPlayer   bool                `json:"is_first_player"`   // nuevo
    PlayersToDelete []string            `json:"players_to_delete"` // nuevo
    AllPlayersAck   map[string]bool     `json:"all_players_ack"`   // nuevo
    AllPlayersRoles map[string]string   `json:"all_players_roles,omitempty"` // nuevo (solo terminales)
    ActivePlayers   []string            `json:"active_players"`    // nuevo
}
```

### 7.2 `impostor/impostor.go` — `GetGameState`

```go
func (i *Impostor) GetGameState(playerID string) game.GameData {
    i.RLock()
    defer i.RUnlock()

    p := i.Players[playerID]

    allAcks := make(map[string]bool, len(i.PlayersAck))
    for id, acked := range i.PlayersAck {
        allAcks[id] = acked
    }

    activePlayers := make([]string, 0)
    for id, gp := range i.Players {
        if gp.Active {
            activePlayers = append(activePlayers, id)
        }
    }

    playersToDelete := i.PlayersToDelete
    if playersToDelete == nil {
        playersToDelete = []string{}
    }

    var allRoles map[string]string
    isTerminal := i.State == FINISH_CIVIL_VICTORY ||
        i.State == FINISH_IMPOSTOR_VICTORY ||
        i.State == SHOWING_RESULT_DRAW
    if isTerminal {
        allRoles = make(map[string]string, len(i.Players))
        for id, gp := range i.Players {
            allRoles[id] = string(gp.Role)
        }
    }

    return DataResponse{
        GameState:       i.State,
        PlayerRole:      p.Role,
        PlayerAck:       i.PlayersAck[playerID],
        PlayerVoted:     i.PlayersHasVoted[playerID],
        PlayersVotes:    i.VotesPerPlayer,
        Word:            p.Word,
        IsFirstPlayer:   i.FirstPlayerID == playerID,
        PlayersToDelete: playersToDelete,
        AllPlayersAck:   allAcks,
        AllPlayersRoles: allRoles,
        ActivePlayers:   activePlayers,
    }
}
```

### 7.3 `impostor/impostor.go` — `wordChoice` (fix §3.7)

```go
func (i *Impostor) wordChoice(data json.RawMessage) error {
    validStates := i.State == GAME_READY ||
        i.State == WORD_PICKING ||
        i.State == SHOWING_RESULT_CONTINUE
    if !validStates {
        return fmt.Errorf("estado inválido para word_choice: %s", i.State)
    }
    // resto sin cambios...
}
```

---

## 8. Estructura de archivos frontend

```
apps/web/src/
├── types/
│   └── index.ts                  # Player, GameData, GamePhase, WordChoicePayload
├── services/
│   ├── socket.ts                 # connectSocket, sendMessage (actualizar normalizer)
│   └── utils.ts
├── context/
│   └── SocketContext.tsx         # Agregar gameData + métodos del juego
├── pages/
│   ├── Home/
│   ├── Lobby/                    # Habilitar botón Jugar para host
│   └── Game/
│       ├── index.tsx             # Switch sobre game_state
│       ├── Game.css
│       └── phases/
│           ├── WordPickingPhase.tsx
│           ├── AwaitingAckPhase.tsx
│           ├── InProgressPhase.tsx
│           ├── VotingPhase.tsx
│           ├── RoundResultPhase.tsx
│           └── ResultsPhase.tsx
├── components/
│   └── Modal/
└── App.tsx                       # Agregar ruta /game/:roomCode
```

---

## 9. Invariantes de seguridad

| Invariante | Implementación |
|---|---|
| Civil nunca ve palabras del impostor | El backend filtra en `GetGameState` por rol — el frontend solo muestra `gameData.word` |
| Impostor nunca ve la palabra real | Ídem |
| Solo el primer jugador puede aceptar la palabra | UI condicional en `is_first_player`; backend valida independientemente |
| Un jugador no puede votar por sí mismo | Validado en backend (`CannotVoteSelf`); UI oculta al jugador propio de la lista |
| Roles revelados solo al final | `all_players_roles` es `null` durante el juego; UI solo renderiza la sección de roles cuando no es null |

---

## 10. Checklist de implementación

### Backend
- [ ] Fix: agregar tag `json:"game_state"` a `DataResponse.GameState`
- [ ] Nuevo campo: `is_first_player`
- [ ] Nuevo campo: `players_to_delete`
- [ ] Nuevo campo: `all_players_ack`
- [ ] Nuevo campo: `all_players_roles` (omitempty, solo terminales)
- [ ] Nuevo campo: `active_players`
- [ ] Fix: `wordChoice` acepta `SHOWING_RESULT_CONTINUE`

### Frontend
- [ ] Actualizar `types/index.ts` con nuevos tipos
- [ ] Actualizar `services/socket.ts` normalizer para `game_state_updated`
- [ ] Actualizar `SocketContext.tsx` con `gameData` y métodos del juego
- [ ] Actualizar `App.tsx`: agregar ruta `/game/:roomCode`
- [ ] Actualizar `Lobby`: habilitar botón "Jugar" para host, navegar a `/game` cuando llega `gameData`
- [ ] Crear `pages/Game/index.tsx` (switch de fases)
- [ ] Crear `WordPickingPhase` (primer jugador: form + preview; resto: spinner)
- [ ] Crear `AwaitingAckPhase` (mostrar palabra + botón ack + progreso del grupo)
- [ ] Crear `InProgressPhase` (mostrar palabra + botón votar solo para primer jugador)
- [ ] Crear `VotingPhase` (lista de jugadores activos + votos en tiempo real + cerrar votación)
- [ ] Crear `RoundResultPhase` (eliminado + siguiente ronda para primer jugador)
- [ ] Crear `ResultsPhase` (ganador + revelar impostores + opciones de volver)
- [ ] Crear `pages/Game/Game.css`
