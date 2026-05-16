package game

import "encoding/json"

type GameState string

type GameData any

type Game interface {
	GetName() string
	Start(players []Player) error
	HandleMessage(playerID string, event string, data json.RawMessage) error
	GetGameState(playerID string) GameData
}
