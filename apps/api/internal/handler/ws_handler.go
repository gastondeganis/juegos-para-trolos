package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	internalws "github.com/gastondeganis/juegos-para-trolos/api/internal/websocket"
	"github.com/gastondeganis/juegos-para-trolos/api/internal/websocket/response"
	"github.com/gorilla/websocket"
)

var roomManager = game.NewRoomManager()

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func WSHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	for {
		var msg internalws.Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println(err)
			return
		}

		switch msg.Event {
		case "create_room":
			var data internalws.CreateRoomData
			if err := json.Unmarshal(msg.Data, &data); err != nil {
				log.Println("error unmarshalling create_room data", err)

				response.WriteError(conn, "create_room_error", "Error creating room: bad request")
				continue
			}

			host := game.Player{
				Name: data.Host,
				ID:   data.HostId,
				Host: true,
				Conn: conn,
			}
			room := roomManager.CreateRoom(host)

			r := response.ResponseMessage[response.PlayerRoomResponse]{
				Event: "room_created",
				Data: response.PlayerRoomResponse{
					RoomCode: room.Code,
					Players:  room.Players,
				},
			}

			if err := conn.WriteJSON(r); err != nil {
				log.Println("error writing room_created", err)
				response.WriteError(conn, "create_room_error", "Error creating room")
			}

		case "player_joined":
			var data internalws.JoinRoomData
			if err := json.Unmarshal(msg.Data, &data); err != nil {
				log.Println("error unmarshalling player_joined data", err)

				response.WriteError(conn, "player_joined_error", "Error joining room: bad request")
				continue
			}

			room, exists := roomManager.GetRoom(data.RoomCode)
			if !exists {
				response.WriteError(conn, "room_not_found", "Error joining room: room not found")
				continue
			}

			room.AddOrUpdatePlayer(data.PlayerID, data.PlayerName, conn)

			joinResponse := response.ResponseMessage[response.PlayerRoomResponse]{
				Event: "room_joined",
				Data: response.PlayerRoomResponse{
					RoomCode: room.Code,
				},
			}
			conn.WriteJSON(joinResponse)

			BroadcastPlayers(room)
		}
	}
}
