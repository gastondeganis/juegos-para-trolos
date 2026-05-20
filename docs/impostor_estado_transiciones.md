# El Impostor — Estados y Transiciones

> Última revisión: 2026-05-20

---

## Estados

| Constante Go | String enviado al frontend |
|---|---|
| `GAME_PREPARATION` | `"preparation"` |
| `GAME_READY` | `"ready"` |
| `WORD_PICKING` | `"word_picking"` |
| `AWAITING_ACK` | `"awaiting_ack"` |
| `IN_PROGRESS` | `"in_progress"` |
| `VOTING` | `"voting"` |
| `CALCULATING_RESULTS` | `"calculating_results"` ⚠️ transitorio, el frontend casi nunca lo ve |
| `SHOWING_RESULT_CONTINUE` | `"showing_results_delete"` |
| `SHOWING_RESULT_DRAW` | `"showing_results_draw"` |
| `FINISH_CIVIL_VICTORY` | `"finish_civil_victory"` |
| `FINISH_IMPOSTOR_VICTORY` | `"finish_impostor_victory"` |
| `GAME_FINISHED` | `"game_finished"` |

---

## Diagrama de transiciones

```
Start() / restartGame()
        │
        │  setupMatch(): asigna roles, inicializa maps
        ▼
[GAME_PREPARATION]
        │
        ▼
  [GAME_READY] ◄──────────────────────────────────────────────────────────────┐
        │                                                                      │
        │ word_choice                                                          │
        ▼                                                                      │
  [WORD_PICKING] ──── word_choice ────► [WORD_PICKING]  (re-pick)             │
        │                                                                      │
        │ word_accepted                                                        │
        ▼                                                                      │
  [AWAITING_ACK]                                                               │
        │                                                                      │
        │ player_acked × N jugadores                                           │
        │ (cuando AckedCount == total)                                         │
        ▼                                                                      │
  [IN_PROGRESS] ◄─────────────────────────────────────┐                       │
        │                                              │                       │
        │ start_voting (solo primer jugador)           │                       │
        ▼                                              │                       │
    [VOTING]                                           │ continue_game         │
        │ player_voted × N  (acumula, no cambia estado)│ Continue=true         │
        │                                              │                       │
        │ election_closed (solo primer jugador)        │                       │
        ▼                                              │                       │
[CALCULATING_RESULTS]  ← transitorio                  │                       │
        │                                              │                       │
        ├─ un líder + impostor eliminado               │      restart_game     │
        │  impostors_left == 0 ─────────────────────────────────────────► [FINISH_CIVIL_VICTORY]
        │                                              │                       │
        ├─ un líder + civil eliminado                  │      restart_game     │
        │  active_civil <= impostors_left ──────────────────────────────► [FINISH_IMPOSTOR_VICTORY]
        │                                              │                       │
        ├─ un líder, juego continúa ────────────────► [SHOWING_RESULT_CONTINUE]│
        │                                              │   continue_game       │
        │                                              │   Restart=true ───────┘
        │                                              │   (ninguno) ──────────────► [GAME_FINISHED]
        │                                              │
        └─ empate / múltiples líderes ──────────────► [SHOWING_RESULT_DRAW]
                                                       │   continue_game
                                                       │   Continue=true ──────┘ (ver arriba)
                                                       │   Restart=true  ──────┘
                                                       │   restart_game  ──────┘
                                                       │   (ninguno) ──────────────► [GAME_FINISHED]
```

---

## Tabla de transiciones

| Estado origen | Evento / acción | Condición | Estado destino |
|---|---|---|---|
| — | `Start()` | — | `GAME_READY` |
| `GAME_READY` | `word_choice` | — | `WORD_PICKING` |
| `WORD_PICKING` | `word_choice` | — | `WORD_PICKING` (re-pick) |
| `WORD_PICKING` | `word_accepted` | — | `AWAITING_ACK` |
| `AWAITING_ACK` | `player_acked` | `AckedCount < total` | `AWAITING_ACK` |
| `AWAITING_ACK` | `player_acked` | `AckedCount == total` | `IN_PROGRESS` |
| `IN_PROGRESS` | `start_voting` | es el primer jugador | `VOTING` |
| `VOTING` | `player_voted` | — | `VOTING` (acumula) |
| `VOTING` | `election_closed` | es el primer jugador | `CALCULATING_RESULTS`* |
| `CALCULATING_RESULTS`* | (interno) | `impostors_left == 0` | `FINISH_CIVIL_VICTORY` |
| `CALCULATING_RESULTS`* | (interno) | `active_civil <= impostors_left` | `FINISH_IMPOSTOR_VICTORY` |
| `CALCULATING_RESULTS`* | (interno) | juego continúa, 1 eliminado | `SHOWING_RESULT_CONTINUE` |
| `CALCULATING_RESULTS`* | (interno) | empate | `SHOWING_RESULT_DRAW` |
| `SHOWING_RESULT_CONTINUE` | `continue_game` | `Continue=true` | `IN_PROGRESS` |
| `SHOWING_RESULT_CONTINUE` | `continue_game` | `Restart=true` | `GAME_READY` |
| `SHOWING_RESULT_CONTINUE` | `continue_game` | ambos false | `GAME_FINISHED` |
| `SHOWING_RESULT_DRAW` | `continue_game` | `Continue=true` | `IN_PROGRESS` |
| `SHOWING_RESULT_DRAW` | `continue_game` | `Restart=true` | `GAME_READY` |
| `SHOWING_RESULT_DRAW` | `continue_game` | ambos false | `GAME_FINISHED` |
| `SHOWING_RESULT_CONTINUE` | `restart_game` | — | `GAME_READY` |
| `SHOWING_RESULT_DRAW` | `restart_game` | — | `GAME_READY` |
| `FINISH_CIVIL_VICTORY` | `restart_game` | — | `GAME_READY` |
| `FINISH_IMPOSTOR_VICTORY` | `restart_game` | — | `GAME_READY` |

> \* `CALCULATING_RESULTS` es transitorio: se asigna y se pisa dentro de la misma llamada a `electionClosed`. El frontend no lo recibe en condiciones normales.

