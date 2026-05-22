package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/game"
	"github.com/gastondeganis/juegos-para-trolos/api/internal/game/impostor"
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

	// Cleanup al cerrar el socket
	defer func() {
		if currentRoom != nil && currentPlayerID != "" {
			isEmpty := currentRoom.RemovePlayer(currentPlayerID)
			if isEmpty {
				roomManager.DeleteRoom(currentRoom.Code)
				log.Printf("Sala %s eliminada (vacía por desconexión)", currentRoom.Code)
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
			log.Println("Error reading JSON:", err)
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

			r := response.MessageResponse[response.PlayerRoomResponse]{
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

			joinResponse := response.MessageResponse[response.PlayerRoomResponse]{
				Event: "room_joined",
				Data: response.PlayerRoomResponse{
					RoomCode: room.Code,
				},
			}
			conn.WriteJSON(joinResponse)

			BroadcastPlayers(room)

			// If a game is already in progress, send current state to the (re)joining player
			if room.Game != nil {
				gameState := room.Game.GetGameState(data.PlayerID)
				gameStateMsg := response.MessageResponse[game.GameData]{
					Event: "game_state_updated",
					Data:  gameState,
				}
				if err := conn.WriteJSON(gameStateMsg); err != nil {
					log.Println("error sending game state on rejoin:", err)
				}
			}

		case "start_game":
			if currentRoom == nil {
				continue
			}

			var cfg internalws.StartGameData
			if err := json.Unmarshal(msg.Data, &cfg); err != nil {
				log.Println("start_game: bad config, using defaults:", err)
			}

			impostorCount := cfg.ImpostorCount
			if impostorCount == 0 {
				impostorCount = 1
			}

			currentRoom.Game = &impostor.Impostor{
				Config: impostor.GameConfig{
					ImpostorCount:     impostorCount,
					ShowImpostorWords: cfg.ShowImpostorWords,
				},
			}

			err := currentRoom.Game.Start(currentRoom.Players)
			if err != nil {
				log.Println("Error starting game:", err)
				continue
			}

			BroadcastGameState(currentRoom)

		case "player_left":
			if currentRoom == nil {
				continue
			}

			isEmpty := currentRoom.RemovePlayer(currentPlayerID)
			roomCode := currentRoom.Code
			currentRoom = nil
			currentPlayerID = ""

			if isEmpty {
				roomManager.DeleteRoom(roomCode)
			} else {
				BroadcastPlayers(currentRoom)
			}

		default:
			if currentRoom != nil && currentRoom.Game != nil {
				err := currentRoom.Game.HandleMessage(currentPlayerID, msg.Event, msg.Data)
				if err != nil {
					log.Println("Error en la lógica del juego:", err)
					continue
				}
				BroadcastGameState(currentRoom)
			}
		}
	}
}
