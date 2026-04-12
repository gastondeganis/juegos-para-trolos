package game

import "github.com/gorilla/websocket"

type Player struct {
	Name string          `json:"name"`
	Host bool            `json:"host"`
	Conn *websocket.Conn `json:"-"`
}
