package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

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

	var currentRoom *game.Room
	var currentPlayerID string

	defer func() {
		if currentRoom != nil && currentPlayerID != "" {
			rem := currentRoom.RemovePlayer(currentPlayerID)
			if rem {
				ok := roomManager.DeleteRoom(currentRoom.Code)
				if !ok {
					log.Printf("delete room %s failed", currentRoom.Code)
					return
				}

				log.Printf("deleted room %s", currentRoom.Code)
			} else {
				BroadcastPlayers(currentRoom)
			}
		}
	}()

	for {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var msg internalws.Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println(err)
			return
		}

		switch msg.Event {
		case "ping":
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			conn.WriteJSON(map[string]string{"event": "pong"})
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
			currentRoom = room
			currentPlayerID = data.HostId

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
			currentRoom = room
			currentPlayerID = data.PlayerID

			joinResponse := response.ResponseMessage[response.PlayerRoomResponse]{
				Event: "room_joined",
				Data: response.PlayerRoomResponse{
					RoomCode: room.Code,
				},
			}
			conn.WriteJSON(joinResponse)

			BroadcastPlayers(room)

		case "player_left":
			var data internalws.LeaveRoomData
			if err := json.Unmarshal(msg.Data, &data); err != nil {
				log.Println("error unmarshalling player_left data", err)
				response.WriteError(conn, "player_left_error", "Error joining room: bad request")
				continue
			}

			room, exists := roomManager.GetRoom(data.RoomCode)
			if !exists {
				response.WriteError(conn, "room_not_found", "Error joining room: room not found")
				continue
			}

			isEmpty := room.RemovePlayer(data.PlayerID)
			currentRoom = nil
			currentPlayerID = ""

			if isEmpty {
				roomManager.DeleteRoom(room.Code)
				log.Printf("sala %s eliminada (vacía)", room.Code)
				conn.WriteJSON(response.ResponseMessage[response.PlayerRoomResponse]{
					Event: "room_deleted",
					Data: response.PlayerRoomResponse{
						RoomCode: room.Code,
					}})
			} else {
				conn.WriteJSON(response.ResponseMessage[response.PlayerRoomResponse]{
					Event: "room_left",
					Data: response.PlayerRoomResponse{
						RoomCode: room.Code,
						Players:  room.Players,
					}})

				BroadcastPlayers(room)
			}
		}
	}
}
