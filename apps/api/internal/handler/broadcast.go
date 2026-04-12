package handler

import (
	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	"github.com/gastondeganis/juegos-para-trolos/api/internal/websocket/response"
)

func BroadcastPlayers(room *game.Room) {

	for _, player := range room.Players {
		player.Conn.WriteJSON(response.ResponseMessage[response.PlayerRoomResponse]{
			Event: "players_updated",
			Data: response.PlayerRoomResponse{
				RoomCode: room.Code,
				Players:  room.Players,
			},
		})
	}
}
