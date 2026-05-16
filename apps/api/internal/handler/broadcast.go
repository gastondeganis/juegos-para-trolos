package handler

import (
	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	"github.com/gastondeganis/juegos-para-trolos/api/internal/websocket/response"
)

func BroadcastPlayers(room *game.Room) {
	room.Mu.RLock()
	defer room.Mu.RUnlock()
	for _, player := range room.Players {
		player.Conn.WriteJSON(response.MessageResponse[response.PlayerRoomResponse]{
			Event: "players_updated",
			Data: response.PlayerRoomResponse{
				RoomCode: room.Code,
				Players:  room.Players,
			},
		})
	}
}

func BroadcastGameState(room *game.Room) {
	room.Mu.RLock()
	defer room.Mu.RUnlock()

	if room.Game == nil {
		return
	}

	for _, p := range room.Players {
		if p.Conn == nil {
			continue
		}

		playerSpecificData := room.Game.GetGameState(p.ID)

		resp := response.GameDataResponse{
			Event: "game_state_updated",
			Data:  playerSpecificData,
		}

		p.Conn.WriteJSON(resp)
	}
}
