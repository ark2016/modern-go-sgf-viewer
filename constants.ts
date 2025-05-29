
import { StoneColor } from './types';

export const DEFAULT_BOARD_SIZE = 19;
export const DEFAULT_KOMI = 6.5;

export const SGF_MAX_SIZE = 19; // Max size for char-to-coord conversion 's'

// Standard handicap points for 19x19 board
export const HANDICAP_POINTS_19: Record<number, { r: number; c: number }[]> = {
  2: [{ r: 3, c: 15 }, { r: 15, c: 3 }],
  3: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }],
  4: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }],
  5: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }, { r: 9, c: 9 }],
  6: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }, { r: 3, c: 9 }, { r: 15, c: 9 }],
  7: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }, { r: 3, c: 9 }, { r: 15, c: 9 }, { r: 9, c: 9 }],
  8: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }, { r: 3, c: 9 }, { r: 15, c: 9 }, { r: 9, c: 3 }, { r: 9, c: 15 }],
  9: [{ r: 3, c: 15 }, { r: 15, c: 3 }, { r: 3, c: 3 }, { r: 15, c: 15 }, { r: 3, c: 9 }, { r: 15, c: 9 }, { r: 9, c: 3 }, { r: 9, c: 15 }, { r: 9, c: 9 }],
};

// Standard handicap points for 13x13 board
export const HANDICAP_POINTS_13: Record<number, { r: number; c: number }[]> = {
  2: [{ r: 3, c: 9 }, { r: 9, c: 3 }],
  3: [{ r: 3, c: 9 }, { r: 9, c: 3 }, { r: 3, c: 3 }],
  4: [{ r: 3, c: 9 }, { r: 9, c: 3 }, { r: 3, c: 3 }, { r: 9, c: 9 }],
  // ... add more as needed
};

// Standard handicap points for 9x9 board
export const HANDICAP_POINTS_9: Record<number, { r: number; c: number }[]> = {
  2: [{ r: 2, c: 6 }, { r: 6, c: 2 }],
  3: [{ r: 2, c: 6 }, { r: 6, c: 2 }, { r: 2, c: 2 }],
  4: [{ r: 2, c: 6 }, { r: 6, c: 2 }, { r: 2, c: 2 }, { r: 6, c: 6 }],
  // ... add more as needed
};

export const PLAYER_COLOR_MAP = {
  [StoneColor.Black]: 'Black',
  [StoneColor.White]: 'White',
  [StoneColor.Empty]: 'Empty',
};

export const GO_RULES_SECTIONS = {
  Overview: `Go is an adversarial game between two players with the objective of capturing territory...`,
  BasicConcepts: `Basic strategic aspects include the following: Connection, Cut, Stay alive...`,
  Strategy: `Strategy deals with global influence, the interaction between distant stones...`,
  Rules: `Aside from the order of play (alternating moves, Black moves first or takes a handicap) and scoring rules, there are essentially only two rules in Go...`,
  Tactics: `Tactics deal with immediate fighting between stones, capturing and saving stones, life, death and other issues localized to a specific part of the board...`
};
// Truncated for brevity, full text will be used in RulesPanel.tsx if it fits CDATA limits.
// Actual full text from prompt will be used in the component.
    