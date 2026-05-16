package impostor

import (
	"encoding/json"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
)

type Impostor struct {
	Players      map[string]GamePlayer
	State        game.GameState
	CurrentWord  *Word
	UsedWords    []*Word
	PlayersAck   map[string]bool
	PlayersVoted map[string]bool
}

func (i *Impostor) GetName() string {
	//TODO implement me
	panic("implement me")
}

func (i *Impostor) HandleMessage(playerID string, event string, data json.RawMessage) error {
	//TODO implement me
	panic("implement me")
}

func (i *Impostor) GetGameState(playerID string) game.GameData {
	p := i.Players[playerID]

	return DataResponse{
		GameState:   i.State,
		PlayerRole:  p.Role,
		PlayerAck:   i.PlayersAck[playerID],
		PlayerVoted: i.PlayersVoted[playerID],
		Word:        p.Word,
	}
}

func (i *Impostor) Start(players []game.Player) error {
	i.State = GAME_PREPARATION

	go InitWordDB()

	i.Players = map[string]GamePlayer{}
	for _, p := range players {
		gamePlayer := GamePlayer{
			Player:   p,
			GameHost: p.Host,
			Role:     CIVIL,
		}
		i.Players[p.ID] = gamePlayer
		i.PlayersAck[p.ID] = false
		i.PlayersVoted[p.ID] = false
	}

	return nil
}
