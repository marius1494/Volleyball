export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  POINT_SCORED = 'POINT_SCORED',
  GAME_OVER = 'GAME_OVER'
}

export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vector;
  vel: Vector;
  radius: number;
  color: string;
  onGround: boolean;
}

export interface GameScore {
  player: number;
  cpu: number;
}

export interface CommentaryResponse {
  text: string;
  mood: 'excited' | 'sarcastic' | 'neutral' | 'encouraging';
}
