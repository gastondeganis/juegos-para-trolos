package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/ws", handler.WSHandler)
	log.Printf("servidor escuchando en :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
