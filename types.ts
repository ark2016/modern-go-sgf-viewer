export enum StoneColor {
  Black = 'B',
  White = 'W',
  Empty = 'E',
}

export interface Point {
  r: number; // row
  c: number; // col
}

// Новые типы для рисования линий и стрелок
export interface DrawingLine {
  start: Point;
  end: Point;
  color?: string;
  thickness?: number;
}

export interface DrawingArrow {
  start: Point;
  end: Point;
  color?: string;
  thickness?: number;
}

export interface SgfGameInfo {
  name?: string;
  playerBlack?: string;
  playerWhite?: string;
  rankBlack?: string;
  rankWhite?: string;
  date?: string;
  result?: string;
  komi?: number;
  handicap?: number;
  boardSize: number;
  ruleset?: string;
  sgfComment?: string; // Root comment from SGF

  // Raw SGF properties from the root/setup node as parsed from the file
  originalRootSgfProps?: Record<string, string[]>;
  // The temporary ID assigned by the parser to the SGF root node concept
  parsedRootNodeId?: string;
}

// Represents a node in the SGF's raw parsed structure during initial parsing phase
export interface SgfNode {
  properties: Record<string, string[]>;
  variations: SgfNode[][]; // Each item is an SgfNode[] representing a sequence for a variation branch
  parent: SgfNode | null; // Parent in the SGF parsing structure (previous in sequence or branch point)
  _tempId?: string; // Temporary ID used during parsing
}

// Represents a processed node in our application's game tree
export interface GameTreeNode {
  id: string; // Unique identifier for this node
  parentId: string | null; // ID of the parent node, null for the root
  childrenIds: string[]; // IDs of child nodes (variations, next moves)
  
  // Core SGF properties for this node
  sgfProps: Record<string, string[]>; // e.g., B[qd], C[comment], AB[aa][bb], TR[cc], LB[dd:Label]
  
  // Move specific data (if this node represents a move)
  player?: StoneColor.Black | StoneColor.White; // Player making the move
  coord?: Point | null; // Coordinate of the move, null for pass
  moveNumber: number; // Displayed move number (1-indexed from first actual play)

  // Game state *after* this node's properties/move are applied
  boardState: StoneColor[][];
  stonesCapturedInThisStep: Point[]; // Stones removed from board by this specific step/move
  totalCapturedByBlack: number; // Total white stones captured by black up to AND INCLUDING this node
  totalCapturedByWhite: number; // Total black stones captured by white up to AND INCLUDING this node
  koState: KoState;
  
  comment?: string; // Comment associated with this node/move (extracted from C property)

  // UI related
  isMainLineNext?: boolean; // Hint if the first child is the primary continuation vs. a variation
                           // This is set on the PARENT node, indicating its first child is main line.
}

export interface FullGameData {
  info: SgfGameInfo;
  // The game tree is represented by a root node ID and a flat map of all nodes
  rootNodeId: string;
  nodes: Record<string, GameTreeNode>; // All nodes in the game, indexed by their ID
  initialPlayerForDisplay: StoneColor.Black | StoneColor.White; // Player to move at game start (after handicap/setup)
}

export interface KoState {
  koPoint: Point | null;
  boardSnapshotBeforeKoTrigger: StoneColor[][] | null;
}

// Kept for compatibility with some components during transition, but aim to replace with GameTreeNode access
export interface ParsedMove {
  id: string; // Link to GameTreeNode
  player: StoneColor.Black | StoneColor.White;
  coord: Point | null;
  comment?: string;
  boardStateAfterMove: StoneColor[][];
  stonesCapturedInThisMove: Point[];
  totalCapturedByBlack: number;
  totalCapturedByWhite: number;
  koStateAfterMove: KoState;
  moveNumber: number;
}

export interface LabelInfo {
  point: Point;
  text: string;
}

// For Edit Mode Toolbar
export enum EditTool {
  VIEW_MODE = 'VIEW_MODE', // Corresponds to !isEditMode (technically not a tool itself)
  EDIT_MODE_SELECT = 'EDIT_MODE_SELECT', // Default tool in edit mode, for selection/navigation (F1 concept)
  PLACE_BLACK = 'PLACE_BLACK', // (F2 was toggle edit mode, maybe assign B?)
  PLACE_WHITE = 'PLACE_WHITE', // (W?)
  REMOVE_STONE = 'REMOVE_STONE', // (E or Del?)
  ADD_TRIANGLE = 'ADD_TRIANGLE', // F4
  ADD_SQUARE = 'ADD_SQUARE', // F5
  ADD_CIRCLE = 'ADD_CIRCLE', // F6
  ADD_MARK_X = 'ADD_MARK_X', // F7
  ADD_LABEL = 'ADD_LABEL', // F8
  ADD_NUMBER = 'ADD_NUMBER', // Числовые метки (1, 2, 3, ...)
  ADD_LETTER = 'ADD_LETTER', // Буквенные метки (A, B, C, ...)
  // Инструменты для рисования
  DRAWING_MODE = 'DRAWING_MODE', // Режим рисования
  DRAW_LINE = 'DRAW_LINE', // Рисование линии
  DRAW_ARROW = 'DRAW_ARROW', // Рисование стрелки
  REMOVE_DRAWING = 'REMOVE_DRAWING', // Удаление линий и стрелок
  DRAW_FREEHAND = 'DRAW_FREEHAND', // Свободное рисование
}

// Режим рисования
export enum DrawingMode {
  NONE = 'NONE',
  LINE = 'LINE',
  ARROW = 'ARROW',
  FREEHAND = 'FREEHAND', // Добавляем режим свободного рисования
  ERASER = 'ERASER', // Режим стирания
}

// Для свободного рисования добавляем тип для хранения путей
export interface DrawingPath {
  points: Point[];
  color?: string;
  thickness?: number;
}
