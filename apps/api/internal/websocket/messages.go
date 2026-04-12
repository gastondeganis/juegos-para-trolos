package websocket

import "encoding/json"

type Message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type CreateRoomData struct {
	Host string `json:"host"`
}

type JoinRoomData struct {
	PlayerName string `json:"player_name"`
	RoomCode   string `json:"room_code"`
}
