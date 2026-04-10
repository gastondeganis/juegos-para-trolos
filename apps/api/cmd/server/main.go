package main

import (
	"log"
	"net/http"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}
	defer conn.Close()

	log.Println("new websocket client connected")

	err = conn.WriteJSON(map[string]string{
		"event":   "connected",
		"message": "bienvenido a El Impostor",
	})
	if err != nil {
		log.Println("write error:", err)
	}

	for {
		var msg map[string]string
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("read error:", err)
			return
		}

		event := msg["event"]

		switch event {
		case "create_room":
			room := roomManager.CreateRoom()

			err = conn.WriteJSON(map[string]string{
				"event": "room_created",
				"code":  room.Code,
			})
			if err != nil {
				log.Println("write error:", err)
				return
			}
		case "join_room":
			code := msg["code"]

			room, exists := roomManager.GetRoom(code)
			if !exists {
				conn.WriteJSON(map[string]string{
					"event":   "error",
					"message": "sala no encontrada",
				})
				continue
			}

			err = conn.WriteJSON(map[string]string{
				"event": "room_joined",
				"code":  room.Code,
			})
			if err != nil {
				log.Println("write error:", err)
				return
			}
		}
	}
}

var roomManager = game.NewRoomManager()

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	http.HandleFunc("/ws", wsHandler)

	log.Println("server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
