package impostor

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"sync"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
)

type GameConfig struct {
	ImpostorCount uint8 `json:"impostor_count"`
}
type Impostor struct {
	sync.RWMutex
	Players         map[string]GamePlayer
	FirstPlayerID   string
	State           game.GameState
	CurrentWord     *Word
	UsedWords       []*Word
	Config          GameConfig
	PlayersAck      map[string]bool
	AckedCount      uint8
	PlayersHasVoted map[string]bool
	PlayerVote      map[string]*GamePlayer
	VotesPerPlayer  map[string]uint8
	impostorsLeft   uint8
	activeCivil     uint8
	PlayersToDelete []string
}

func (i *Impostor) GetName() string {
	return "Impostor"
}

func (i *Impostor) HandleMessage(playerID string, event string, data json.RawMessage) error {
	i.Lock()
	defer i.Unlock()

	switch event {
	case "word_choice":
		err := i.wordChoice(data)
		if err != nil {
			return err
		}
	case "word_accepted":
		i.AckedCount = 0
		for id := range i.PlayersAck {
			i.PlayersAck[id] = false
		}
		i.State = AWAITING_ACK
	case "player_acked":
		err := i.playerAcked(playerID, data)
		if err != nil {
			return err
		}
	case "start_voting":
		if err := i.startVoting(playerID); err != nil {
			return err
		}
	case "player_voted":
		if err := i.playerVoted(playerID, data); err != nil {
			return err
		}

	case "election_closed":
		if err := i.electionClosed(playerID); err != nil {
			return err
		}
	case "restart_game":
		if err := i.restartGame(); err != nil {
			return err
		}
	}
	return nil
}

func (i *Impostor) wordChoice(data json.RawMessage) error {
	if !((i.State == GAME_READY) || (i.State == WORD_PICKING)) {
		return fmt.Errorf("game state should be GAME_PREPARATION but got %s", i.State)
	}

	i.State = WORD_PICKING

	var wChoiceData WordChoiceEventData
	if err := json.Unmarshal(data, &wChoiceData); err != nil {
		return err
	}

	var w *Word
	var err error

	if wChoiceData.Random {
		if wChoiceData.Category != "" {
			w, err = GetRandomWordFromCategory(wChoiceData.Category)
		} else {
			w, err = GetRandomWord()
		}

		if err != nil {
			return fmt.Errorf("error al obtener palabra aleatoria: %w", err)
		}
	} else {
		w = &Word{
			RealWord:      wChoiceData.InputWord,
			ImpostorWords: wChoiceData.InputImpostorWords,
		}
	}

	i.UsedWords = append(i.UsedWords, w)
	i.CurrentWord = w

	// TODO: ver tema de config para que se pueda switchear entre ??? y palabras
	for id, p := range i.Players {
		if p.Role == CIVIL {
			p.Word = []string{w.RealWord}
		} else {
			p.Word = w.ImpostorWords
		}
		i.Players[id] = p
	}
	return nil
}

func (i *Impostor) GetGameState(playerID string) game.GameData {
	i.RLock()
	defer i.RUnlock()

	p := i.Players[playerID]

	return DataResponse{
		GameState:    i.State,
		PlayerRole:   p.Role,
		PlayerAck:    i.PlayersAck[playerID],
		PlayerVoted:  i.PlayersHasVoted[playerID],
		PlayersVotes: i.VotesPerPlayer,
		Word:         p.Word,
	}
}

func (i *Impostor) Start(players []game.Player, cfg GameConfig) error {
	i.Lock()
	defer i.Unlock()

	i.Config = cfg
	if i.Config.ImpostorCount == 0 {
		i.Config.ImpostorCount = 1
	}

	if err := i.setupMatch(players); err != nil {
		return err
	}

	i.State = GAME_READY
	return nil
}

func (i *Impostor) playerAcked(playerID string, data json.RawMessage) error {
	if i.State != AWAITING_ACK {
		return fmt.Errorf("game state should be AWAITING_ACK but got %s", i.State)
	}

	var d PlayerAckedData
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}
	if !i.PlayersAck[playerID] {
		if d.Acked {
			i.PlayersAck[playerID] = true
			i.AckedCount++
		} else {
			i.PlayersAck[playerID] = false
			i.AckedCount--
		}
	}
	if i.AckedCount == uint8(len(i.Players)) {
		i.State = IN_PROGRESS
	}
	return nil
}

func (i *Impostor) startVoting(pID string) error {
	if i.State != IN_PROGRESS {
		return fmt.Errorf("game state should be IN_PROGRESS but got %s", i.State)
	}
	if i.FirstPlayerID != pID {
		return fmt.Errorf("first player with id %s can start voting, but was %s", i.FirstPlayerID, pID)
	}
	i.State = VOTING
	return nil
}

func (i *Impostor) playerVoted(pID string, data json.RawMessage) error {
	if i.State != VOTING {
		return fmt.Errorf("game state should be VOTING but got %s", i.State)
	}

	var d PlayerVotedData
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}

	if pID == d.VotedPlayerID {
		return CannotVoteSelf
	}

	targetPlayer, exists := i.Players[d.VotedPlayerID]
	if !exists {
		return fmt.Errorf("el jugador votado no existe")
	}

	previousVote, hasVotedBefore := i.PlayerVote[pID]

	if hasVotedBefore && previousVote.ID == d.VotedPlayerID {
		return nil
	}

	if hasVotedBefore {
		i.VotesPerPlayer[previousVote.ID]--
	}

	i.VotesPerPlayer[d.VotedPlayerID]++
	i.PlayersHasVoted[pID] = true
	i.PlayerVote[pID] = &targetPlayer

	return nil
}

func (i *Impostor) electionClosed(pID string) error {
	if !(i.State == VOTING || i.State == CALCULATING_RESULTS) {
		return fmt.Errorf("game state should be VOTING but got %s", i.State)
	}
	if i.FirstPlayerID != pID {
		return fmt.Errorf("solo el primer jugador puede cerrar la votacion")
	}

	i.State = CALCULATING_RESULTS

	var leaders []string
	var maxVotes uint8 = 0

	if len(i.VotesPerPlayer) == 0 {
		return fmt.Errorf("no voto nadie")
	}

	for playerID, votes := range i.VotesPerPlayer {
		if votes > maxVotes {
			maxVotes = votes
			leaders = make([]string, 1, len(i.VotesPerPlayer))
			leaders[0] = playerID
			continue
		}

		if votes == maxVotes && votes > 0 {
			leaders = append(leaders, playerID)
		}
	}

	i.PlayersToDelete = leaders

	if len(leaders) == 1 {
		playerID := leaders[0]
		p, ok := i.Players[playerID]
		if !ok {
			return fmt.Errorf("el jugador votado no existe")
		}

		if p.Role == IMPOSTOR {
			i.impostorsLeft--
		} else {
			i.activeCivil--
		}

		p.Active = false
		i.Players[playerID] = p

		if i.impostorsLeft == 0 {
			i.State = FINISH_CIVIL_VICTORY
		} else if i.activeCivil <= i.impostorsLeft {
			i.State = FINISH_IMPOSTOR_VICTORY
		} else {
			i.State = SHOWING_RESULT_CONTINUE
		}

	} else {
		i.State = SHOWING_RESULT_DRAW
	}

	return nil
}

func (i *Impostor) restartGame() error {
	if !(i.State == FINISH_CIVIL_VICTORY || i.State == FINISH_IMPOSTOR_VICTORY || i.State == SHOWING_RESULT_DRAW) {
		return fmt.Errorf("no se puede reiniciar el juego si no ha terminado")
	}

	currentPlayers := make([]game.Player, 0, len(i.Players))
	for _, p := range i.Players {
		currentPlayers = append(currentPlayers, p.Player)
	}

	if err := i.setupMatch(currentPlayers); err != nil {
		return err
	}

	i.State = GAME_READY
	return nil
}

func (i *Impostor) setupMatch(players []game.Player) error {
	totalPlayers := len(players)
	if totalPlayers == 0 {
		return fmt.Errorf("no hay jugadores para iniciar la partida")
	}

	i.State = GAME_PREPARATION
	i.AckedCount = 0
	i.CurrentWord = nil
	i.PlayersToDelete = nil

	i.Players = make(map[string]GamePlayer)
	i.PlayersAck = make(map[string]bool)
	i.PlayersHasVoted = make(map[string]bool)
	i.VotesPerPlayer = make(map[string]uint8)
	i.PlayerVote = make(map[string]*GamePlayer)

	playerIDs := make([]string, totalPlayers)
	for idx, p := range players {
		playerIDs[idx] = p.ID
	}

	rand.Shuffle(len(playerIDs), func(idx1, idx2 int) {
		playerIDs[idx1], playerIDs[idx2] = playerIDs[idx2], playerIDs[idx1]
	})

	i.FirstPlayerID = playerIDs[0]

	for idx, id := range playerIDs {
		var origPlayer game.Player
		for _, p := range players {
			if p.ID == id {
				origPlayer = p
				break
			}
		}

		determinedRole := CIVIL
		if uint8(idx) < i.Config.ImpostorCount {
			determinedRole = IMPOSTOR
		}

		i.Players[id] = GamePlayer{
			Player:   origPlayer,
			GameHost: origPlayer.Host,
			Role:     determinedRole,
			Active:   true,
			Word:     nil,
		}

		i.PlayersAck[id] = false
		i.PlayersHasVoted[id] = false
		i.VotesPerPlayer[id] = 0
		i.PlayerVote[id] = nil
	}

	i.impostorsLeft = i.Config.ImpostorCount
	i.activeCivil = uint8(totalPlayers) - i.impostorsLeft

	return nil
}
