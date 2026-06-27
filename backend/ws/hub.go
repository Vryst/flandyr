package ws

import (
	"log"
	"encoding/json"
	"math"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// Hub ngatur semua client yang connect, dan jadi satu-satunya "pemilik"
// dari map clients (biar gak ada race condition pas banyak goroutine jalan bareng)
type Hub struct {
	clients    map[*Client]bool
	players    map[string]*Player
	monsters   map[string]*Monster

	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
}

func (h *Hub) broadcastPlayers() {
	type Payload struct {
		Type    string    `json:"type"`
		Players []*Player `json:"players"`
	}

	players := make([]*Player, 0)

	for _, p := range h.players {
		players = append(players, p)
	}

	data, _ := json.Marshal(Payload{
		Type:    "players",
		Players: players,
	})

	for client := range h.clients {
		client.send <- data
	}
}

func (h *Hub) broadcastMonsters() {
	type Payload struct {
		Type     string     `json:"type"`
		Monsters []*Monster `json:"monsters"`
	}

	monsters := make([]*Monster, 0)

	for _, m := range h.monsters {
		monsters = append(monsters, m)
	}

	data, _ := json.Marshal(Payload{
		Type:     "monsters",
		Monsters: monsters,
	})

	for client := range h.clients {
		client.send <- data
	}
}
// NewHub bikin instance Hub baru, siap dipakai
func NewHub() *Hub {
	h := &Hub{
		clients:    make(map[*Client]bool),
		players:    make(map[string]*Player),
		monsters:   make(map[string]*Monster),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
	}

	// spawn satu monster awal di tengah arena
	monster := &Monster{
		ID: uuid.NewString(),
		X:  500,
		Y:  350,
		HP: 200,
	}
	h.monsters[monster.ID] = monster

	return h
}

// Run dijalankan sebagai goroutine terpisah (go hub.Run() di main.go).
// Infinite loop yang dengerin channel + ticker AI — karena cuma goroutine ini
// yang nyentuh map clients/players/monsters, gak perlu mutex, gak ada race condition.
func (h *Hub) Run() {
	aiTicker := time.NewTicker(100 * time.Millisecond)
	defer aiTicker.Stop()

	for {
		select {
		case <-aiTicker.C:
			h.monsterAI()
			h.respawnCheck()

		case client := <-h.register:
			h.clients[client] = true
			h.players[client.Player.ID] = client.Player

			h.broadcastPlayers()
			h.broadcastMonsters()

			log.Printf(
				"player %s join, total: %d",
				client.Player.ID,
				len(h.clients),
			)
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {

				delete(h.players, client.Player.ID)
				delete(h.clients, client)
				h.broadcastPlayers()

				close(client.send)

				log.Printf(
					"player %s leave, sisa: %d",
					client.Player.ID,
					len(h.clients),
				)
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
					// pesan masuk ke antrian kirim client — aman

				default:
					// channel send client penuh → client ini dianggap macet/lambat
					// hapus dulu dari map sebelum close, biar gak ada yang kirim lagi
					// ke channel yang sudah di-close (bakal panic kalau kejadian)
					delete(h.clients, client)
					close(client.send)
					log.Printf("client diputus karena channel send penuh")
				}
			}
		}
	}
}

// monsterAI jalan tiap tick (dipanggil dari Run, jadi otomatis race-free
// karena cuma goroutine ini yang nyentuh players/monsters).
// Tiap monster: cari player terdekat, gerak ke arahnya, dan kalau udah
// dalam radius skill (dan cooldown udah habis), pakai skill area —
// sama persis kayak skill milik player.
func (h *Hub) monsterAI() {
	const moveSpeed = 2.0
	const skillRange = 160.0
	const skillDamage = 25
	const skillCooldown = 3 * time.Second

	if len(h.players) == 0 || len(h.monsters) == 0 {
		return
	}

	moved := false

	for _, m := range h.monsters {
		if m.HP <= 0 {
			continue
		}

		// cari player terdekat
		var nearest *Player
		nearestDist := math.MaxFloat64

		for _, p := range h.players {
			if p.HP <= 0 {
				continue
			}

			dx := p.X - m.X
			dy := p.Y - m.Y
			dist := math.Sqrt(dx*dx + dy*dy)

			if dist < nearestDist {
				nearestDist = dist
				nearest = p
			}
		}

		if nearest == nil {
			continue
		}

		// kalau masih di luar range skill, gerak mendekat
		if nearestDist > skillRange {
			dx := nearest.X - m.X
			dy := nearest.Y - m.Y

			length := math.Sqrt(dx*dx + dy*dy)
			if length > 0 {
				m.X += (dx / length) * moveSpeed
				m.Y += (dy / length) * moveSpeed
				moved = true
			}
			continue
		}

		// udah dalam range — pakai skill kalau cooldown udah habis
		now := time.Now()
		if now.Sub(m.lastSkillAt) < skillCooldown {
			continue
		}
		m.lastSkillAt = now

		hit := make([]string, 0)

		for _, p := range h.players {
			if p.HP <= 0 {
				continue
			}

			dx := p.X - m.X
			dy := p.Y - m.Y
			dist := math.Sqrt(dx*dx + dy*dy)

			if dist <= skillRange {
				p.HP -= skillDamage
				if p.HP <= 0 {
					p.HP = 0
					p.deadAt = time.Now()
				}
				hit = append(hit, p.ID)
			}
		}

		effect := map[string]any{
			"type":   "skillEffect",
			"id":     m.ID,
			"x":      m.X,
			"y":      m.Y,
			"radius": skillRange,
			"hit":    hit,
		}
		effectMsg, _ := json.Marshal(effect)
		h.broadcast <- effectMsg

		h.broadcastPlayers()
	}

	if moved {
		h.broadcastMonsters()
	}
}

// respawnCheck jalan tiap tick (sama goroutine, jadi race-free).
// Player yang HP 0 di-respawn otomatis setelah playerRespawnDelay,
// monster yang HP 0 di-respawn otomatis setelah monsterRespawnDelay.
func (h *Hub) respawnCheck() {
	const playerRespawnDelay = 3 * time.Second
	const monsterRespawnDelay = 5 * time.Second

	playersChanged := false
	monstersChanged := false

	for _, p := range h.players {
		if p.HP <= 0 && !p.deadAt.IsZero() && time.Since(p.deadAt) >= playerRespawnDelay {
			p.X = rand.Float64() * 1000
			p.Y = rand.Float64() * 700
			p.HP = 100
			p.deadAt = time.Time{}
			playersChanged = true
		}
	}

	for _, m := range h.monsters {
		if m.HP <= 0 && !m.deadAt.IsZero() && time.Since(m.deadAt) >= monsterRespawnDelay {
			m.X = 500
			m.Y = 350
			m.HP = 200
			m.deadAt = time.Time{}
			monstersChanged = true
		}
	}

	if playersChanged {
		h.broadcastPlayers()
	}
	if monstersChanged {
		h.broadcastMonsters()
	}
}