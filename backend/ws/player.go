package ws

import "time"

type Player struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	HP        int     `json:"hp"`
	AvatarURL string  `json:"avatarUrl,omitempty"`

	deadAt time.Time
}