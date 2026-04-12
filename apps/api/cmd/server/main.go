package main

import (
	"log"
	"net/http"

	"github.com/gastondeganis/juegos-para-trolos/api/internal/handler"
)

func main() {
	http.HandleFunc("/ws", handler.WSHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
