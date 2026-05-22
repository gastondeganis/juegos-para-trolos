export type Player = {
  id: string;
  name: string;
  host: boolean;
};

export type GameState =
  | 'preparation'
  | 'ready'
  | 'word_picking'
  | 'awaiting_ack'
  | 'in_progress'
  | 'voting'
  | 'showing_results_draw'
  | 'showing_results_delete'
  | 'finish_civil_victory'
  | 'finish_impostor_victory'
  | 'game_finished';

export type Role = 'civil' | 'impostor';

export type GameData = {
  game_state: GameState;
  player_role: Role;
  player_ack: boolean;
  player_voted: boolean;
  word: string[];
  players_votes: Record<string, number>;
  is_first_player: boolean;
  first_player_id: string;
  eliminated_player_ids: string[];
  active_player_ids: string[];
  all_players_ack: Record<string, boolean>;
  all_players_roles: Record<string, Role> | null;
};

export type GameConfig = {
  impostorCount: number;
  showImpostorWords: boolean;
};
