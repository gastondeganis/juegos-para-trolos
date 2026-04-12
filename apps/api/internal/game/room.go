package game

type Room struct {
	Code    string   `json:"code"`
	Players []Player `json:"players"`
}
