package game

import (
	"math/rand"
	"sync"
)

type Room struct {
	Code string
}

type RoomManager struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom() *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	code := generateCode()

	room := &Room{
		Code: code,
	}

	rm.rooms[code] = room
	return room
}

func generateCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 6)

	for i := range code {
		code[i] = chars[rand.Intn(len(chars))]
	}

	return string(code)
}
