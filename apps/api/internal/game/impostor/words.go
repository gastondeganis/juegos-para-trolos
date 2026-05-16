package impostor

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type WordCategory struct {
	Category string `json:"category_name"`
	Words    []Word `json:"words"`
}
type Word struct {
	RealWord      string   `json:"word"`
	ImpostorWords []string `json:"impostor_words"`
}

var (
	GlobalWords []WordCategory
	once        sync.Once
)

func InitWordDB() {
	once.Do(func() {
		words, _ := LoadAllWords()
		GlobalWords = words
	})
}

func GetCategory(name string) (*WordCategory, bool) {
	for _, cat := range GlobalWords {
		if cat.Category == name {
			return &cat, true
		}
	}
	return nil, false
}

func LoadAllWords() ([]WordCategory, error) {
	data, err := os.ReadFile("data/words.json")
	if err != nil {
		return nil, fmt.Errorf("error leyendo archivo de palabras: %w", err)
	}
	var allWords []WordCategory
	err = json.Unmarshal(data, &allWords)
	if err != nil {
		return nil, fmt.Errorf("error parseando archivo de palabras: %w", err)
	}

	return allWords, nil
}
