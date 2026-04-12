package game

import "math/rand"

type RoomManager struct {
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom(host Player) *Room {
	code := generateCode()
	room := &Room{
		Code:    code,
		Players: []Player{host},
	}
	rm.rooms[code] = room
	return room
}

func (rm *RoomManager) GetRoom(code string) (*Room, bool) {
	room, exists := rm.rooms[code]
	return room, exists
}

func generateCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 6)

	for i := range code {
		code[i] = chars[rand.Intn(len(chars))]
	}

	return string(code)
}
