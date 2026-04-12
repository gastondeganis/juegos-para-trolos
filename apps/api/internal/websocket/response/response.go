package response

import (
	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	"github.com/gorilla/websocket"
)

type ResponseMessage[T any] struct {
	Event string `json:"event"`
	Data  T      `json:"data"`
}

type PlayerRoomResponse struct {
	RoomCode string        `json:"room_code"`
	Players  []game.Player `json:"players"`
}

type ErrorResponse struct {
	Message string `json:"message"`
}

func WriteError(conn *websocket.Conn, event, message string) {
	errResponse := ResponseMessage[ErrorResponse]{
		Event: event,
		Data: ErrorResponse{
			Message: message,
		},
	}
	conn.WriteJSON(errResponse)
}
