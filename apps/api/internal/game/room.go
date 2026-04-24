package game

import (
	"sync"

	"github.com/gorilla/websocket"
)

type RoomStatus string

const (
	WAITING  RoomStatus = "waiting"
	PLAYING  RoomStatus = "playing"
	FINISHED RoomStatus = "finished"
)

type Room struct {
	Code    string     `json:"code"`
	Players []Player   `json:"players"`
	Status  RoomStatus `json:"status"`
	Mu      sync.RWMutex
}

func (r *Room) AddOrUpdatePlayer(id string, name string, conn *websocket.Conn) {
	r.Mu.Lock()
	defer r.Mu.Unlock()

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

func (r *Room) RemovePlayer(id string) bool {
	r.Mu.Lock()
	defer r.Mu.Unlock()

	for i := range r.Players {
		if r.Players[i].ID == id {
			isHost := r.Players[i].Host
			p := append(r.Players[:i], r.Players[i+1:]...)
			if len(p) == 0 {
				return true
			}
			if isHost {
				p[0].Host = true
			}
			r.Players = p
			return false
		}
	}
	return false
}
