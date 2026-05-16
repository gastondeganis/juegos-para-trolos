package impostor

import (
	"encoding/json"
	"fmt"
	"math/rand"
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

func GetRandomWord() (*Word, error) {
	if len(GlobalWords) == 0 {
		return nil, fmt.Errorf("la base de datos de palabras está vacía")
	}

	// 1. Aplanamos todas las palabras en un pool local
	var allWords []Word
	for _, cat := range GlobalWords {
		allWords = append(allWords, cat.Words...)
	}

	// 2. Usamos tu lógica de shuffle sobre este pool local seguro
	return getRandomWord(allWords)
}

// GetRandomWordFromCategory busca la categoría y te da una palabra aleatoria de ella.
func GetRandomWordFromCategory(categoryName string) (*Word, error) {
	cat, found := GetCategory(categoryName)
	if !found {
		return nil, fmt.Errorf("la categoría '%s' no existe", categoryName)
	}

	// 3. CLONACIÓN CRÍTICA: Copiamos el slice para no desordenar la variable GlobalWords en el Shuffle
	localWords := make([]Word, len(cat.Words))
	copy(localWords, cat.Words)

	return getRandomWord(localWords)
}

func getRandomWord(wl []Word) (*Word, error) {
	if len(wl) == 0 {
		return nil, fmt.Errorf("no hay palabras disponibles")
	}

	rand.Shuffle(len(wl), func(i, j int) {
		(wl)[i], (wl)[j] = (wl)[j], (wl)[i]
	})

	return &wl[0], nil
}
