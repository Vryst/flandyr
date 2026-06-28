package ws

import "time"

// Monster adalah entity musuh yang dikontrol AI di server (bukan player).
// Dia ikut disiarkan ke semua client lewat broadcastMonsters, dan punya
// skill area yang sama persis kayak player (lihat monsterAI di hub.go).
type Monster struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
	HP int     `json:"hp"`

	lastSkillAt time.Time
	deadAt      time.Time
}