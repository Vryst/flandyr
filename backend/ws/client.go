package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	
	"math/rand"
	"math"

)

const (
	// batas waktu tunggu saat nulis pesan ke client
	writeWait = 10 * time.Second

	// batas waktu tunggu pong dari client (keepalive check)
	pongWait = 60 * time.Second

	// seberapa sering kirim ping ke client — HARUS lebih kecil dari pongWait
	pingPeriod = (pongWait * 9) / 10

	// ukuran maksimal pesan yang boleh diterima dari client (bytes)
	// dinaikkan ke 512KB buat support upload avatar base64
	maxMessageSize = 512 * 1024
)

// Client merepresentasikan satu koneksi WebSocket (satu player yang connect)
type Client struct {
	conn *websocket.Conn
	hub  *Hub
	send chan []byte

	Player *Player

	lastSkillAt    time.Time
	lastZoneAt     time.Time
	lastTeleportAt time.Time
}

func NewClient(hub *Hub, conn *websocket.Conn) {
	player := &Player{
		ID: uuid.NewString(),
		X: rand.Float64() * 1000,
		Y: rand.Float64() * 700,
		HP: 100,
	}
	client := &Client{
		conn:   conn,
		hub:    hub,
		send:   make(chan []byte, 256),
		Player: player,
	}

	hub.register <- client

	welcome := map[string]any{
		"type": "welcome",
		"id": player.ID,
		"x": player.X,
		"y": player.Y,
		"hp": player.HP,
	}
	msg, _ := json.Marshal(welcome)
	client.send <- msg

	go client.writePump()
	go client.readPump()
}

// readPump jalan sebagai goroutine sendiri per client.
// Tugasnya CUMA baca pesan masuk dari browser, terus lempar ke Hub buat broadcast.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	// batasi ukuran pesan & set deadline awal
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))

	// tiap kali terima pong dari browser, perpanjang deadline-nya
	// ini pola standar keepalive WebSocket
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			// cek apakah ini error "normal" (client nutup tab/koneksi)
			// atau error tak terduga yang perlu di-log
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("unexpected close error: %v", err)
			}
			// error apapun -> keluar loop, defer bakal unregister & tutup conn
			break
		}

		var data map[string]any

		if err := json.Unmarshal(message, &data); err != nil {
			continue
		}

		if c.Player.HP <= 0 {
			// lagi mati, nunggu respawn — abaikan semua aksi
			continue
		}

		if data["type"] == "setAvatar" {
			avatarUrl, ok := data["avatarUrl"].(string)
			if ok && len(avatarUrl) <= 512*1024 {
				c.Player.AvatarURL = avatarUrl
				c.hub.broadcastPlayers()
			}
		}
		if data["type"] == "move" {
			dir, ok := data["dir"].(string)
			if !ok {
				continue
			}

			const speed = 5.0

			switch dir {
			case "up":
				c.Player.Y -= speed

			case "down":
				c.Player.Y += speed

			case "left":
				c.Player.X -= speed

			case "right":
				c.Player.X += speed
			}
			if c.Player.X < 0 {
				c.Player.X = 0
			}

			if c.Player.Y < 0 {
				c.Player.Y = 0
			}

			if c.Player.X > 968 {
				c.Player.X = 968
			}

			if c.Player.Y > 668 {
				c.Player.Y = 668
			}

			c.hub.broadcastPlayers()
		}
		if data["type"] == "attack" {

			const attackRange = 80.0
			const damage = 10

			for _, target := range c.hub.players {

				if target.ID == c.Player.ID {
					continue
				}

				dx := target.X - c.Player.X
				dy := target.Y - c.Player.Y

				distance := math.Sqrt(dx*dx + dy*dy)

				if distance <= attackRange {

					if target.HP > 0 {
						target.HP -= damage

						if target.HP <= 0 {
							target.HP = 0
							target.deadAt = time.Now()
						}
					}
				}
			}

			for _, monster := range c.hub.monsters {

				dx := monster.X - c.Player.X
				dy := monster.Y - c.Player.Y

				distance := math.Sqrt(dx*dx + dy*dy)

				if distance <= attackRange {

					if monster.HP > 0 {
						monster.HP -= damage

						if monster.HP <= 0 {
							monster.HP = 0
							monster.deadAt = time.Now()
						}
					}
				}
			}

			c.hub.broadcastPlayers()
			c.hub.broadcastMonsters()
		}
		if data["type"] == "skill" {

			const skillRange = 160.0
			const skillDamage = 25
			const skillCooldown = 3 * time.Second

			now := time.Now()

			if now.Sub(c.lastSkillAt) < skillCooldown {
				// masih cooldown, abaikan request
				continue
			}

			c.lastSkillAt = now

			hit := make([]string, 0)

			for _, target := range c.hub.players {

				if target.ID == c.Player.ID {
					continue
				}

				dx := target.X - c.Player.X
				dy := target.Y - c.Player.Y

				distance := math.Sqrt(dx*dx + dy*dy)

				if distance <= skillRange {

					if target.HP > 0 {
						target.HP -= skillDamage

						if target.HP <= 0 {
							target.HP = 0
							target.deadAt = time.Now()
						}

						hit = append(hit, target.ID)
					}
				}
			}

			for _, monster := range c.hub.monsters {

				dx := monster.X - c.Player.X
				dy := monster.Y - c.Player.Y

				distance := math.Sqrt(dx*dx + dy*dy)

				if distance <= skillRange {

					if monster.HP > 0 {
						monster.HP -= skillDamage

						if monster.HP <= 0 {
							monster.HP = 0
							monster.deadAt = time.Now()
						}

						hit = append(hit, monster.ID)
					}
				}
			}

			// broadcast efek skill (buat animasi di frontend) + update HP
			effect := map[string]any{
				"type":   "skillEffect",
				"id":     c.Player.ID,
				"x":      c.Player.X,
				"y":      c.Player.Y,
				"radius": skillRange,
				"hit":    hit,
			}
			effectMsg, _ := json.Marshal(effect)
			c.hub.broadcast <- effectMsg

			c.hub.broadcastPlayers()
			c.hub.broadcastMonsters()
		}
		if data["type"] == "placeZone" {
			const zoneRadius   = 80.0
			const zoneDamage   = 40
			const zoneMaxRange = 220.0 // sedikit lebih longgar dari frontend (200) buat toleransi
			const zoneCooldown = 5 * time.Second

			now := time.Now()
			if now.Sub(c.lastZoneAt) < zoneCooldown {
				continue
			}

			tx, okX := data["x"].(float64)
			ty, okY := data["y"].(float64)
			if !okX || !okY {
				continue
			}

			// validasi jangkauan dari center player
			dx := tx - (c.Player.X + 16)
			dy := ty - (c.Player.Y + 16)
			if math.Sqrt(dx*dx+dy*dy) > zoneMaxRange {
				continue
			}

			c.lastZoneAt = now

			hit := make([]string, 0)

			for _, target := range c.hub.players {
				if target.ID == c.Player.ID || target.HP <= 0 {
					continue
				}
				// pakai center target (player size 32 → center +16)
				ddx := (target.X + 16) - tx
				ddy := (target.Y + 16) - ty
				if math.Sqrt(ddx*ddx+ddy*ddy) <= zoneRadius {
					target.HP -= zoneDamage
					if target.HP <= 0 {
						target.HP = 0
						target.deadAt = time.Now()
					}
					hit = append(hit, target.ID)
				}
			}

			for _, monster := range c.hub.monsters {
				if monster.HP <= 0 {
					continue
				}
				// pakai center monster (monster size 48 → center +24)
				ddx := (monster.X + 24) - tx
				ddy := (monster.Y + 24) - ty
				if math.Sqrt(ddx*ddx+ddy*ddy) <= zoneRadius {
					monster.HP -= zoneDamage
					if monster.HP <= 0 {
						monster.HP = 0
						monster.deadAt = time.Now()
					}
					hit = append(hit, monster.ID)
				}
			}

			effect := map[string]any{
				"type":     "zoneEffect",
				"casterId": c.Player.ID,
				"x":        tx,
				"y":        ty,
				"radius":   zoneRadius,
				"hit":      hit,
			}
			effectMsg, _ := json.Marshal(effect)
			c.hub.broadcast <- effectMsg

			c.hub.broadcastPlayers()
			c.hub.broadcastMonsters()
		}
		if data["type"] == "teleport" {
			const teleportDist     = 150.0
			const teleportCooldown = 4 * time.Second

			now := time.Now()
			if now.Sub(c.lastTeleportAt) < teleportCooldown {
				continue
			}

			dir, ok := data["dir"].(string)
			if !ok {
				continue
			}

			c.lastTeleportAt = now

			switch dir {
			case "up":
				c.Player.Y -= teleportDist
			case "down":
				c.Player.Y += teleportDist
			case "left":
				c.Player.X -= teleportDist
			case "right":
				c.Player.X += teleportDist
			}

			// clamp ke batas arena
			if c.Player.X < 0 { c.Player.X = 0 }
			if c.Player.Y < 0 { c.Player.Y = 0 }
			if c.Player.X > 968 { c.Player.X = 968 }
			if c.Player.Y > 668 { c.Player.Y = 668 }

			effect := map[string]any{
				"type": "teleportEffect",
				"id":   c.Player.ID,
				"x":    c.Player.X,
				"y":    c.Player.Y,
			}
			effectMsg, _ := json.Marshal(effect)
			c.hub.broadcast <- effectMsg

			c.hub.broadcastPlayers()
		}
		}
	}

// writePump jalan sebagai goroutine sendiri per client.
// Tugasnya CUMA nulis ke koneksi, baca dari channel send.
// Karena cuma goroutine ini yang nulis ke conn, gak akan ada race condition.
func (c *Client) writePump() {
	// ticker buat kirim ping secara berkala ke browser (keepalive)
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			// set deadline sebelum nulis — biar gak nunggu selamanya kalau client ngehang
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))

			if !ok {
				// channel send ditutup oleh Hub (client di-unregister)
				// kirim CloseMessage biar browser tau koneksi resmi ditutup
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("write error: %v", err)
				return
			}

		case <-ticker.C:
			// waktunya ping — kalau gagal, berarti client udah gak responsive
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("ping error, client mungkin disconnect: %v", err)
				return
			}
		}
	}
}