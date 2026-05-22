package impostor

import (
	"errors"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
)

type Role string

const (
	IMPOSTOR Role = "impostor"
	CIVIL    Role = "civil"
)

var (
	CannotVoteSelf error = errors.New("cannot vote self")
)

const (
	GAME_PREPARATION        game.GameState = "preparation"
	GAME_READY              game.GameState = "ready"
	WORD_PICKING            game.GameState = "word_picking"
	AWAITING_ACK            game.GameState = "awaiting_ack"
	IN_PROGRESS             game.GameState = "in_progress"
	VOTING                  game.GameState = "voting"
	CALCULATING_RESULTS     game.GameState = "calculating_results"
	SHOWING_RESULT_CONTINUE game.GameState = "showing_results_delete"
	SHOWING_RESULT_DRAW     game.GameState = "showing_results_draw"
	FINISH_CIVIL_VICTORY    game.GameState = "finish_civil_victory"
	FINISH_IMPOSTOR_VICTORY game.GameState = "finish_impostor_victory"
	GAME_FINISHED           game.GameState = "game_finished"
)

type DataResponse struct {
	GameState           game.GameState      `json:"game_state"`
	PlayerRole          Role                `json:"player_role"`
	PlayerAck           bool                `json:"player_ack"`
	PlayerVoted         bool                `json:"player_voted"`
	Word                []string            `json:"word"`
	PlayersVotes        map[string]uint8    `json:"players_votes"`
	IsFirstPlayer       bool                `json:"is_first_player"`
	FirstPlayerID       string              `json:"first_player_id"`
	EliminatedPlayerIDs []string            `json:"eliminated_player_ids"`
	ActivePlayerIDs     []string            `json:"active_player_ids"`
	AllPlayersAck       map[string]bool     `json:"all_players_ack"`
	AllPlayersRoles     map[string]string   `json:"all_players_roles,omitempty"`
}

type GamePlayer struct {
	game.Player
	GameHost bool
	Role     Role
	Word     []string
	Active   bool
}

type WordChoiceEventData struct {
	Random             bool     `json:"random"`
	Category           string   `json:"category"`
	InputWord          string   `json:"input_word"`
	InputImpostorWords []string `json:"input_impostor_words"`
	AddInputWord       bool     `json:"add_input_word"`
}

type PlayerAckedData struct {
	Acked bool `json:"acked"`
}

type PlayerVotedData struct {
	Voted         bool   `json:"voted"`
	VotedPlayerID string `json:"voted_player_id"`
}

type DataContinue struct {
	Continue bool `json:"continue"`
	Restart  bool `json:"restart"`
}
