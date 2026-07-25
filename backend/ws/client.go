package ws

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait = 10 * time.Second
	pongWait  = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	// avatar tidak lagi dikirim via WS, jadi cukup kecil
	maxMessageSize = 4 * 1024 // 4KB
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

// sendCooldownAck kirim konfirmasi ke client bahwa aksi diterima server
// beserta durasi cooldown-nya (dalam ms). Frontend update CD dari sini,
// bukan dari asumsi sendiri — server adalah satu-satunya otoritas.
func (c *Client) sendCooldownAck(action string, durationMs int64) {
	msg, _ := json.Marshal(map[string]any{
		"type":       "cooldownAck",
		"action":     action,
		"durationMs": durationMs,
	})
	// non-blocking: kalau channel penuh, skip — jangan sampai block readPump
	select {
	case c.send <- msg:
	default:
	}
}

func NewClient(hub *Hub, conn *websocket.Conn) {
	player := &Player{
		ID: uuid.NewString(),
		X:  rand.Float64() * 1000,
		Y:  rand.Float64() * 700,
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
		"id":   player.ID,
		"x":    player.X,
		"y":    player.Y,
		"hp":   player.HP,
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

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("unexpected close error: %v", err)
			}
			break
		}

		var data map[string]any
		if err := json.Unmarshal(message, &data); err != nil {
			continue
		}

		if c.Player.HP <= 0 {
			continue
		}

		if data["type"] == "updateAvatarUrl" {
			// Frontend kirim URL avatar yang sudah di-upload via HTTP endpoint /upload-avatar.
			// Tidak ada base64 di sini — hanya string URL pendek.
			avatarUrl, ok := data["avatarUrl"].(string)
			if ok && len(avatarUrl) <= 512 {
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
				if math.Sqrt(dx*dx+dy*dy) <= attackRange && target.HP > 0 {
					target.HP -= damage
					if target.HP <= 0 {
						target.HP = 0
						target.deadAt = time.Now()
					}
				}
			}

			for _, monster := range c.hub.monsters {
				dx := monster.X - c.Player.X
				dy := monster.Y - c.Player.Y
				if math.Sqrt(dx*dx+dy*dy) <= attackRange && monster.HP > 0 {
					monster.HP -= damage
					if monster.HP <= 0 {
						monster.HP = 0
						monster.deadAt = time.Now()
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
				if math.Sqrt(dx*dx+dy*dy) <= skillRange && target.HP > 0 {
					target.HP -= skillDamage
					if target.HP <= 0 {
						target.HP = 0
						target.deadAt = time.Now()
					}
					hit = append(hit, target.ID)
				}
			}

			for _, monster := range c.hub.monsters {
				dx := monster.X - c.Player.X
				dy := monster.Y - c.Player.Y
				if math.Sqrt(dx*dx+dy*dy) <= skillRange && monster.HP > 0 {
					monster.HP -= skillDamage
					if monster.HP <= 0 {
						monster.HP = 0
						monster.deadAt = time.Now()
					}
					hit = append(hit, monster.ID)
				}
			}

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

			// konfirmasi ke client bahwa skill diterima + mulai CD
			c.sendCooldownAck("skill", int64(skillCooldown/time.Millisecond))
		}

		if data["type"] == "placeZone" {
			const zoneRadius   = 80.0
			const zoneDamage   = 40
			const zoneMaxRange = 220.0
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

			// konfirmasi ke client bahwa zone diterima + mulai CD
			c.sendCooldownAck("zone", int64(zoneCooldown/time.Millisecond))
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

			// konfirmasi ke client bahwa teleport diterima + mulai CD
			c.sendCooldownAck("teleport", int64(teleportCooldown/time.Millisecond))
		}
	}
}

// writePump jalan sebagai goroutine sendiri per client.
// Tugasnya CUMA nulis ke koneksi, baca dari channel send.
// Karena cuma goroutine ini yang nulis ke conn, gak akan ada race condition.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))

			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("write error: %v", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("ping error, client mungkin disconnect: %v", err)
				return
			}
		}
	}
}