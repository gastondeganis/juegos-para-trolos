package game

import (
	"time"

	"github.com/gorilla/websocket"
)

type Player struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Host     bool            `json:"host"`
	Conn     *websocket.Conn `json:"-"`
	LastSeen time.Time       `json:"last_seen"`
}
