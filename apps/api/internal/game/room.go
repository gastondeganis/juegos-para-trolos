package game

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Room struct {
	Code    string   `json:"code"`
	Players []Player `json:"players"`
	Mu      sync.RWMutex
}

func (r *Room) AddOrUpdatePlayer(id string, name string, conn *websocket.Conn) {
	r.Mu.RLock()
	defer r.Mu.RUnlock()

	for i := range r.Players {
		if r.Players[i].ID == id {
			r.Players[i].Conn = conn
			r.Players[i].Name = name
			return
		}
	}

	r.Players = append(r.Players, Player{
		ID:   id,
		Name: name,
		Host: false,
		Conn: conn,
	})
}
