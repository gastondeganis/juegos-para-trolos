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

func (r *Room) RemovePlayer(id string) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	for i := range r.Players {
		if r.Players[i].ID == id {
			p := append(r.Players[:i], r.Players[i+1:]...)
			if r.Players[i].Host {
				p[0].Host = true
			}
			r.Players = p
			return
		}
	}
}
