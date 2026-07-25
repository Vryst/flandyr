"use client";

import { useEffect, useRef, useState } from "react";
import { Player, Monster } from "@/types/player";

export interface SkillEffect {
  id: string;
  x: number;
  y: number;
  radius: number;
  hit: string[];
  key: number;
}

export interface ZoneEffect {
  casterId: string;
  x: number;
  y: number;
  radius: number;
  hit: string[];
  key: number;
}

// CD dalam ms
export interface Cooldowns {
  skill: number;   // E — 3s
  zone: number;    // Q — 5s
  teleport: number; // F — 4s
}

export function useSocket() {
  const ws = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const playerIdRef = useRef("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  const [skillEffects, setSkillEffects] = useState<SkillEffect[]>([]);
  const [zoneEffects, setZoneEffects] = useState<ZoneEffect[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);

  // cooldown tracking (waktu selesai CD, dalam ms epoch)
  const [cooldowns, setCooldowns] = useState<Cooldowns>({ skill: 0, zone: 0, teleport: 0 });

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => { setConnected(true); console.log("connected"); };
    socket.onclose = () => { setConnected(false); console.log("disconnected"); };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "players") {
        setPlayers(data.players);
        const current = data.players.find((p: Player) => p.id === playerIdRef.current);
        if (current) setMe(current);
      }
      if (data.type === "welcome") {
        setPlayerId(data.id);
        playerIdRef.current = data.id;
        setMe({ id: data.id, x: data.x, y: data.y, hp: data.hp });
      }
      if (data.type === "monsters") setMonsters(data.monsters);

      // Bug 1 fix: cooldown sekarang di-set dari konfirmasi server (cooldownAck),
      // bukan dari asumsi durasi di frontend. Server adalah satu-satunya otoritas.
      if (data.type === "cooldownAck") {
        const endsAt = Date.now() + (data.durationMs as number);
        setCooldowns((prev) => ({ ...prev, [data.action as string]: endsAt }));
      }

      if (data.type === "skillEffect") {
        const effect: SkillEffect = {
          id: data.id, x: data.x, y: data.y,
          radius: data.radius, hit: data.hit ?? [],
          key: Date.now() + Math.random(),
        };
        setSkillEffects((prev) => [...prev, effect]);
        setTimeout(() => setSkillEffects((prev) => prev.filter((e) => e.key !== effect.key)), 400);
      }
      if (data.type === "zoneEffect") {
        const effect: ZoneEffect = {
          casterId: data.casterId, x: data.x, y: data.y,
          radius: data.radius, hit: data.hit ?? [],
          key: Date.now() + Math.random(),
        };
        setZoneEffects((prev) => [...prev, effect]);
        setTimeout(() => setZoneEffects((prev) => prev.filter((e) => e.key !== effect.key)), 800);
      }
    };

    return () => { socket.close(); };
  }, []);

  const send = (data: unknown) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify(data));
  };

  const placeZone = (x: number, y: number) => {
    send({ type: "placeZone", x, y });
    // cooldown akan diupdate saat server membalas dengan cooldownAck
  };

  const useSkill = () => {
    send({ type: "skill" });
    // cooldown akan diupdate saat server membalas dengan cooldownAck
  };

  const teleport = (dir: string) => {
    send({ type: "teleport", dir });
    // cooldown akan diupdate saat server membalas dengan cooldownAck
  };

  return {
    connected,
    playerId,
    me,
    players,
    skillEffects,
    zoneEffects,
    monsters,
    cooldowns,
    send,
    placeZone,
    useSkill,
    teleport,
  };
}