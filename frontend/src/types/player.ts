export interface Player {
  id: string;
  x: number;
  y: number;
  hp: number;
  avatarUrl?: string;
}

export interface Monster {
  id: string;
  x: number;
  y: number;
  hp: number;
}