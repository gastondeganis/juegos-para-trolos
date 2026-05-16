package impostor

import "github.com/gastondeganis/juegos-para-trolos/api/internal/game"

type Role string

const (
	IMPOSTOR Role = "impostor"
	CIVIL    Role = "civil"
)

const (
	GAME_PREPARATION game.GameState = "preparation"
	AWAITING_ACK     game.GameState = "awaiting_ack"
	IN_PROGRESS      game.GameState = "in_progress"
	VOTING           game.GameState = "voting"
	SHOWING_RESULTS  game.GameState = "showing_results"
	GAME_FINISHED    game.GameState = "game_finished"
)

type DataResponse struct {
	GameState   game.GameState
	PlayerRole  Role     `json:"player_role"`
	PlayerAck   bool     `json:"player_ack"`
	PlayerVoted bool     `json:"player_voted"`
	Word        []string `json:"word"`
}

type GamePlayer struct {
	game.Player
	GameHost bool
	Role     Role
	Word     []string
}
