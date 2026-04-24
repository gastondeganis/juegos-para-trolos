package game

import (
	"math/rand"
	"sync"
)

type RoomManager struct {
	Mu    sync.RWMutex
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) CreateRoom(host Player) *Room {
	rm.Mu.Lock()
	defer rm.Mu.Unlock()
	
	code := generateCode()
	room := &Room{
		Code:    code,
		Players: []Player{host},
		Status:  WAITING,
	}
	rm.rooms[code] = room
	return room
}

func (rm *RoomManager) GetRoom(code string) (*Room, bool) {
	rm.Mu.RLock()
	defer rm.Mu.RUnlock()

	room, exists := rm.rooms[code]
	return room, exists
}

func (rm *RoomManager) DeleteRoom(code string) bool {
	rm.Mu.Lock()
	defer rm.Mu.Unlock()

	_, ok := rm.rooms[code]
	if ok {
		delete(rm.rooms, code)
		return true
	}
	return false
}

func generateCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 6)

	for i := range code {
		code[i] = chars[rand.Intn(len(chars))]
	}

	return string(code)
}
