package impostor

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"sync"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
)

type GameConfig struct {
	ImpostorCount     uint8 `json:"impostor_count"`
	ShowImpostorWords bool  `json:"show_impostor_words"`
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
		if i.State != WORD_PICKING {
			return fmt.Errorf("game state should be WORD_PICKING but got %s", i.State)
		}
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
	case "continue_game":
		if err := i.continueGame(playerID, data); err != nil {
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
	if !((i.State == GAME_READY) || (i.State == WORD_PICKING) || (i.State == SHOWING_RESULT_CONTINUE)) {
		return fmt.Errorf("game state should be GAME_READY, WORD_PICKING or SHOWING_RESULT_CONTINUE but got %s", i.State)
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

	for id, p := range i.Players {
		if p.Role == CIVIL {
			p.Word = []string{w.RealWord}
		} else {
			if i.Config.ShowImpostorWords {
				p.Word = w.ImpostorWords
			}
		}
		i.Players[id] = p
	}
	return nil
}

func (i *Impostor) GetGameState(playerID string) game.GameData {
	i.RLock()
	defer i.RUnlock()

	p := i.Players[playerID]

	activePlayerIDs := make([]string, 0, len(i.Players))
	for id, gp := range i.Players {
		if gp.Active {
			activePlayerIDs = append(activePlayerIDs, id)
		}
	}

	eliminatedIDs := make([]string, len(i.PlayersToDelete))
	copy(eliminatedIDs, i.PlayersToDelete)

	allAcks := make(map[string]bool, len(i.PlayersAck))
	for id, acked := range i.PlayersAck {
		allAcks[id] = acked
	}

	isTerminal := i.State == FINISH_CIVIL_VICTORY ||
		i.State == FINISH_IMPOSTOR_VICTORY ||
		i.State == SHOWING_RESULT_DRAW ||
		i.State == GAME_FINISHED
	var allRoles map[string]string
	if isTerminal {
		allRoles = make(map[string]string, len(i.Players))
		for id, gp := range i.Players {
			allRoles[id] = string(gp.Role)
		}
	}

	return DataResponse{
		GameState:           i.State,
		PlayerRole:          p.Role,
		PlayerAck:           i.PlayersAck[playerID],
		PlayerVoted:         i.PlayersHasVoted[playerID],
		PlayersVotes:        i.VotesPerPlayer,
		Word:                p.Word,
		IsFirstPlayer:       i.FirstPlayerID == playerID,
		EliminatedPlayerIDs: eliminatedIDs,
		ActivePlayerIDs:     activePlayerIDs,
		AllPlayersAck:       allAcks,
		AllPlayersRoles:     allRoles,
	}
}

func (i *Impostor) Start(players []game.Player) error {
	i.Lock()
	defer i.Unlock()

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
	if !i.PlayersAck[playerID] && d.Acked {
		i.PlayersAck[playerID] = true
		i.AckedCount++
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

	voter, exists := i.Players[pID]
	if !exists || !voter.Active {
		return fmt.Errorf("los jugadores eliminados no pueden votar")
	}

	var d PlayerVotedData
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}

	if pID == d.VotedPlayerID {
		return CannotVoteSelf
	}

	targetPlayer, exists := i.Players[d.VotedPlayerID]
	if !exists || !targetPlayer.Active {
		return fmt.Errorf("el jugador votado no existe o ya fue eliminado")
	}

	previousVote, hasVotedBefore := i.PlayerVote[pID]

	// Acceso correcto usando el campo promocionado Player del struct game
	if hasVotedBefore && previousVote.Player.ID == d.VotedPlayerID {
		return nil // Idempotencia: ya lo había votado
	}

	if hasVotedBefore {
		i.VotesPerPlayer[previousVote.Player.ID]--
	}

	i.VotesPerPlayer[d.VotedPlayerID]++
	i.PlayersHasVoted[pID] = true

	realTarget := i.Players[d.VotedPlayerID]
	i.PlayerVote[pID] = &realTarget

	return nil
}

func (i *Impostor) electionClosed(pID string) error {
	if i.State != VOTING {
		return fmt.Errorf("game state should be VOTING but got %s", i.State)
	}
	if i.FirstPlayerID != pID {
		return fmt.Errorf("solo el primer jugador puede cerrar la votacion")
	}

	i.State = CALCULATING_RESULTS

	var leaders []string
	var maxVotes uint8 = 0

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

	if maxVotes == 0 {
		return fmt.Errorf("nadie emitió un voto")
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
			if i.FirstPlayerID == p.Player.ID {
				for nextID, nextPlayer := range i.Players {
					if nextPlayer.Active {
						i.FirstPlayerID = nextID
						break
					}
				}
			}
			// Juego sigue
			i.State = SHOWING_RESULT_CONTINUE
		}

	} else {
		// Juego sigue
		i.State = SHOWING_RESULT_DRAW
	}

	return nil
}

func (i *Impostor) restartGame() error {
	if !(i.State == FINISH_CIVIL_VICTORY || i.State == FINISH_IMPOSTOR_VICTORY ||
		i.State == SHOWING_RESULT_DRAW || i.State == SHOWING_RESULT_CONTINUE) {
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
		if uint8(idx) >= uint8(totalPlayers)-i.Config.ImpostorCount {
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
	}

	i.impostorsLeft = i.Config.ImpostorCount
	i.activeCivil = uint8(totalPlayers) - i.impostorsLeft

	return nil
}

func (i *Impostor) continueGame(pID string, data json.RawMessage) error {
	if !(i.State == SHOWING_RESULT_CONTINUE || i.State == SHOWING_RESULT_DRAW) {
		return fmt.Errorf("no se puede continuar la partida desde el estado %s", i.State)
	}

	if pID != i.FirstPlayerID {
		return fmt.Errorf("player %s is not the first player. Only first players can continue game", pID)
	}

	var c DataContinue
	if err := json.Unmarshal(data, &c); err != nil {
		return err
	}

	if c.Continue {
		i.PlayersToDelete = nil

		for id := range i.Players {
			i.PlayersHasVoted[id] = false
			i.VotesPerPlayer[id] = 0
			delete(i.PlayerVote, id)
		}

		i.State = IN_PROGRESS
		return nil
	}

	if c.Restart {
		return i.restartGame()
	}

	i.State = GAME_FINISHED
	return nil
}
