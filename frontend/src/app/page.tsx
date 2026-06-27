"use client";

import { useSocket } from "@/hooks/useSocket";
import { useEffect, useRef, useState } from "react";

const ZONE_MAX_RANGE = 200;
const ZONE_RADIUS = 80;
const PLAYER_SIZE = 32;
const PLAYER_CENTER = PLAYER_SIZE / 2;

// CooldownBar component
function CooldownBar({ label, keybind, endsAt, totalMs }: { label: string; keybind: string; endsAt: number; totalMs: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const pct = remaining > 0 ? (remaining / totalMs) * 100 : 0;
  const ready = remaining === 0;

  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className="text-xs text-gray-300">{label}</div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ready ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${100 - pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-400">
        {ready ? <span className="text-green-400">Ready</span> : `${(remaining / 1000).toFixed(1)}s`}
      </div>
      <div className="text-xs text-gray-500">[{keybind}]</div>
    </div>
  );
}

export default function Home() {
  const {
    players, playerId, me, send,
    skillEffects, zoneEffects, monsters,
    cooldowns, setAvatar, placeZone, useSkill, teleport,
  } = useSocket();

  const keys = useRef({ w: false, a: false, s: false, d: false });
  const lastDirRef = useRef<string>("down"); // arah gerak terakhir buat teleport
  const arenaRef = useRef<HTMLDivElement>(null);
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  const zoneModeRef = useRef(false);
  const [zoneMode, setZoneMode] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const playerCenter = (p: { x: number; y: number }) => ({
    cx: p.x + PLAYER_CENTER,
    cy: p.y + PLAYER_CENTER,
  });

  const inRange = (mx: number, my: number) => {
    const p = meRef.current;
    if (!p) return false;
    const { cx, cy } = playerCenter(p);
    return Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2) <= ZONE_MAX_RANGE;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") { keys.current.w = true; lastDirRef.current = "up"; }
      if (key === "a") { keys.current.a = true; lastDirRef.current = "left"; }
      if (key === "s") { keys.current.s = true; lastDirRef.current = "down"; }
      if (key === "d") { keys.current.d = true; lastDirRef.current = "right"; }
      if (key === "q") { zoneModeRef.current = true; setZoneMode(true); }
      if (key === "f") teleport(lastDirRef.current);
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keys.current.w = false;
      if (key === "a") keys.current.a = false;
      if (key === "s") keys.current.s = false;
      if (key === "d") keys.current.d = false;
      if (key === "q") { zoneModeRef.current = false; setZoneMode(false); setMousePos(null); }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [teleport]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (zoneModeRef.current) return;
      if (keys.current.w) send({ type: "move", dir: "up" });
      if (keys.current.s) send({ type: "move", dir: "down" });
      if (keys.current.a) send({ type: "move", dir: "left" });
      if (keys.current.d) send({ type: "move", dir: "right" });
    }, 50);
    return () => clearInterval(interval);
  }, [send]);

  useEffect(() => {
    const handleAttack = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      send({ type: "attack" });
    };
    window.addEventListener("keydown", handleAttack);
    return () => window.removeEventListener("keydown", handleAttack);
  }, [send]);

  useEffect(() => {
    const handleSkill = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e") return;
      useSkill();
    };
    window.addEventListener("keydown", handleSkill);
    return () => window.removeEventListener("keydown", handleSkill);
  }, [useSkill]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) { alert("Gambar terlalu besar! Maksimal 300KB."); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleArenaMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoneModeRef.current) return;
    const rect = arenaRef.current!.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleArenaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoneModeRef.current) return;
    const rect = arenaRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!inRange(x, y)) return;
    placeZone(x, y);
    setMousePos(null);
  };

  const meCenter = me ? playerCenter(me) : null;

  return (
    <main className="flex flex-col items-center justify-center h-screen gap-3">
      {/* Top bar: avatar + skill CD */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">
            {me?.avatarUrl ? "Ganti Avatar" : "Upload Avatar"}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          {me?.avatarUrl && (
            <img src={me.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-blue-400" />
          )}
        </div>

        {/* Skill cooldown bars */}
        <div className="flex items-end gap-4 px-4 py-2 bg-gray-800 rounded-lg">
          <CooldownBar label="Attack" keybind="Space" endsAt={0} totalMs={1000} />
          <CooldownBar label="Skill" keybind="E" endsAt={cooldowns.skill} totalMs={3000} />
          <CooldownBar label="Zone" keybind="Q+Click" endsAt={cooldowns.zone} totalMs={5000} />
          <CooldownBar label="Teleport" keybind="F" endsAt={cooldowns.teleport} totalMs={4000} />
        </div>
      </div>

      {/* Arena */}
      <div
        ref={arenaRef}
        className="relative border"
        style={{ width: 1000, height: 700, cursor: zoneMode ? "crosshair" : "default" }}
        onMouseMove={handleArenaMouseMove}
        onMouseLeave={() => setMousePos(null)}
        onClick={handleArenaClick}
      >
        {/* Jangkauan zone */}
        {zoneMode && meCenter && (
          <div
            className="absolute rounded-full border-2 border-orange-400/50 pointer-events-none"
            style={{
              left: meCenter.cx - ZONE_MAX_RANGE,
              top: meCenter.cy - ZONE_MAX_RANGE,
              width: ZONE_MAX_RANGE * 2,
              height: ZONE_MAX_RANGE * 2,
            }}
          />
        )}

        {/* Preview zone di mouse */}
        {zoneMode && mousePos && (
          <div
            className="absolute rounded-full pointer-events-none border-2 transition-colors"
            style={{
              left: mousePos.x - ZONE_RADIUS,
              top: mousePos.y - ZONE_RADIUS,
              width: ZONE_RADIUS * 2,
              height: ZONE_RADIUS * 2,
              borderColor: inRange(mousePos.x, mousePos.y) ? "#f97316" : "#6b7280",
              backgroundColor: inRange(mousePos.x, mousePos.y) ? "rgba(249,115,22,0.15)" : "rgba(107,114,128,0.1)",
            }}
          />
        )}

        {/* Zone effects */}
        {zoneEffects.map((effect) => (
          <div
            key={effect.key}
            className="absolute rounded-full border-2 border-orange-500 bg-orange-400/30 animate-ping pointer-events-none"
            style={{
              left: effect.x - effect.radius,
              top: effect.y - effect.radius,
              width: effect.radius * 2,
              height: effect.radius * 2,
            }}
          />
        ))}

        {/* Monster */}
        {monsters.map((monster) => (
          <div key={monster.id}>
            <div className="absolute text-xs text-white" style={{ left: monster.x, top: monster.y - 20 }}>{monster.hp}</div>
            <div
              className="absolute bg-purple-600"
              style={{ left: monster.x, top: monster.y, width: 48, height: 48, borderRadius: "50%", opacity: monster.hp <= 0 ? 0.25 : 1 }}
            />
          </div>
        ))}

        {/* Player */}
        {players.map((player) => {
          const isMe = player.id === playerId;
          return (
            <div key={player.id}>
              <div className="absolute text-xs text-white" style={{ left: player.x, top: player.y - 20 }}>{player.hp}</div>
              <div
                style={{
                  position: "absolute",
                  left: player.x, top: player.y,
                  width: PLAYER_SIZE, height: PLAYER_SIZE,
                  borderRadius: "50%", overflow: "hidden",
                  opacity: player.hp <= 0 ? 0.25 : 1,
                  border: `2px solid ${isMe ? "#3b82f6" : "#ef4444"}`,
                  backgroundColor: isMe ? "#3b82f6" : "#ef4444",
                }}
              >
                {player.avatarUrl && (
                  <img src={player.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Skill Effects (E) */}
        {skillEffects.map((effect) => (
          <div
            key={effect.key}
            className="absolute rounded-full border-2 border-yellow-400 bg-yellow-300/20"
            style={{
              left: effect.x + PLAYER_CENTER - effect.radius,
              top: effect.y + PLAYER_CENTER - effect.radius,
              width: effect.radius * 2,
              height: effect.radius * 2,
            }}
          />
        ))}
      </div>
    </main>
  );
}