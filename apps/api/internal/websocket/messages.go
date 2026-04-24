package websocket

import "encoding/json"

type Message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type CreateRoomData struct {
	Host   string `json:"host"`
	HostId string `json:"host_id"`
}

type JoinRoomData struct {
	PlayerName string `json:"player_name"`
	PlayerID   string `json:"player_id"`
	RoomCode   string `json:"room_code"`
}

type LeaveRoomData struct {
	PlayerID string `json:"player_id"`
	RoomCode string `json:"room_code"`
}
