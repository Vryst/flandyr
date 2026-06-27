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
    const socket = new WebSocket("ws://172.16.100.22:8080/ws")
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

  const send = (data: any) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify(data));
  };

  const setAvatar = (avatarUrl: string) => send({ type: "setAvatar", avatarUrl });

  const placeZone = (x: number, y: number) => {
    send({ type: "placeZone", x, y });
    setCooldowns((prev) => ({ ...prev, zone: Date.now() + 5000 }));
  };

  const useSkill = () => {
    send({ type: "skill" });
    setCooldowns((prev) => ({ ...prev, skill: Date.now() + 3000 }));
  };

  const teleport = (dir: string) => {
    send({ type: "teleport", dir });
    setCooldowns((prev) => ({ ...prev, teleport: Date.now() + 4000 }));
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
    setAvatar,
    placeZone,
    useSkill,
    teleport,
  };
}