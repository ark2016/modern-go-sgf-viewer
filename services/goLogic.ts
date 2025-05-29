
import { StoneColor, Point, KoState } from '../types';

// Helper to create a deep copy of the board
export function cloneBoard(board: StoneColor[][]): StoneColor[][] {
  return board.map(row => [...row]);
}

// Helper to check if a point is within board boundaries
function isInBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

// Find connected group of stones and their liberties
export function getGroupAndLiberties(
  board: StoneColor[][],
  startR: number,
  startC: number
): { group: Point[]; liberties: Point[] } {
  const size = board.length;
  const color = board[startR][startC];
  if (color === StoneColor.Empty) {
    return { group: [], liberties: [] };
  }

  const group: Point[] = [];
  const liberties: Point[] = [];
  const visited: boolean[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(false));
  const libertySet = new Set<string>(); // Store liberties as "r,c" to avoid duplicates

  const q: Point[] = [{ r: startR, c: startC }];
  visited[startR][startC] = true;

  while (q.length > 0) {
    const curr = q.shift()!;
    group.push(curr);

    const neighbors = [
      { r: curr.r - 1, c: curr.c },
      { r: curr.r + 1, c: curr.c },
      { r: curr.r, c: curr.c - 1 },
      { r: curr.r, c: curr.c + 1 },
    ];

    for (const n of neighbors) {
      if (isInBounds(n.r, n.c, size)) {
        if (board[n.r][n.c] === StoneColor.Empty) {
          if (!libertySet.has(`${n.r},${n.c}`)) {
            liberties.push(n);
            libertySet.add(`${n.r},${n.c}`);
          }
        } else if (board[n.r][n.c] === color && !visited[n.r][n.c]) {
          visited[n.r][n.c] = true;
          q.push(n);
        }
      }
    }
  }
  return { group, liberties };
}

export function createEmptyBoard(size: number): StoneColor[][] {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(StoneColor.Empty));
}

export interface ApplyMoveResult {
  newBoard: StoneColor[][];
  stonesCapturedInThisMove: Point[];
  newKoState: KoState;
  error?: string;
}

export function applyMove(
  board: StoneColor[][],
  player: StoneColor.Black | StoneColor.White,
  coord: Point,
  currentKoState: KoState
): ApplyMoveResult {
  const size = board.length;
  const originalBoard = cloneBoard(board); 

  if (!isInBounds(coord.r, coord.c, size) || originalBoard[coord.r][coord.c] !== StoneColor.Empty) {
    return { newBoard: originalBoard, stonesCapturedInThisMove: [], newKoState: currentKoState, error: "Invalid move: Point is not empty or out of bounds." };
  }

  // Ko Rule Check:
  if (currentKoState.koPoint && currentKoState.koPoint.r === coord.r && currentKoState.koPoint.c === coord.c) {
     const tempBoardAfterKoViolatingMove = cloneBoard(originalBoard);
     tempBoardAfterKoViolatingMove[coord.r][coord.c] = player;
     
     const opponent = player === StoneColor.Black ? StoneColor.White : StoneColor.Black;
     let capturesForKoCheck: Point[] = [];
     const opponentNeighbors = [
        { r: coord.r - 1, c: coord.c }, { r: coord.r + 1, c: coord.c },
        { r: coord.r, c: coord.c - 1 }, { r: coord.r, c: coord.c + 1 },
     ];

     for (const n of opponentNeighbors) {
        if (isInBounds(n.r, n.c, size) && tempBoardAfterKoViolatingMove[n.r][n.c] === opponent) {
            const { group, liberties } = getGroupAndLiberties(tempBoardAfterKoViolatingMove, n.r, n.c);
            if (liberties.length === 0) {
                group.forEach(stone => {
                    if (!capturesForKoCheck.some(p => p.r === stone.r && p.c === stone.c)) {
                        capturesForKoCheck.push(stone);
                    }
                });
            }
        }
     }
     
     const boardForKoComparison = cloneBoard(tempBoardAfterKoViolatingMove);
     capturesForKoCheck.forEach(p => boardForKoComparison[p.r][p.c] = StoneColor.Empty);

     if (currentKoState.boardSnapshotBeforeKoTrigger && 
         boardsAreEqual(boardForKoComparison, currentKoState.boardSnapshotBeforeKoTrigger) &&
         capturesForKoCheck.length === 1 && 
         originalBoard[capturesForKoCheck[0].r][capturesForKoCheck[0].c] === opponent 
        ) {
       return { newBoard: originalBoard, stonesCapturedInThisMove: [], newKoState: currentKoState, error: "Invalid move: Ko violation." };
     }
  }
  
  const newBoard = cloneBoard(originalBoard); 
  newBoard[coord.r][coord.c] = player;
  let stonesCapturedInThisMove: Point[] = [];
  const opponentColor = player === StoneColor.Black ? StoneColor.White : StoneColor.Black;

  const neighbors = [
    { r: coord.r - 1, c: coord.c }, { r: coord.r + 1, c: coord.c },
    { r: coord.r, c: coord.c - 1 }, { r: coord.r, c: coord.c + 1 },
  ];

  for (const n of neighbors) {
    if (isInBounds(n.r, n.c, size) && newBoard[n.r][n.c] === opponentColor) {
      const { group, liberties } = getGroupAndLiberties(newBoard, n.r, n.c);
      if (liberties.length === 0) {
        group.forEach(stone => {
          if (newBoard[stone.r][stone.c] !== StoneColor.Empty) { 
             newBoard[stone.r][stone.c] = StoneColor.Empty;
             stonesCapturedInThisMove.push(stone);
          }
        });
      }
    }
  }

  const { group: ownGroup, liberties: ownLiberties } = getGroupAndLiberties(newBoard, coord.r, coord.c);
  if (ownLiberties.length === 0) {
    if (stonesCapturedInThisMove.length === 0) {
       return { newBoard: originalBoard, stonesCapturedInThisMove: [], newKoState: currentKoState, error: "Invalid move: Suicide." };
    }
  }
  
  let newKoState: KoState = { koPoint: null, boardSnapshotBeforeKoTrigger: null };
  if (stonesCapturedInThisMove.length === 1) {
      const capturedStonePos = stonesCapturedInThisMove[0];
      const tempBoardForKoCheck = cloneBoard(newBoard); 
      tempBoardForKoCheck[capturedStonePos.r][capturedStonePos.c] = opponentColor;
      
      const { group: newStoneGroup, liberties: newStoneLiberties } = getGroupAndLiberties(tempBoardForKoCheck, coord.r, coord.c);

      if (newStoneLiberties.length === 0) {
        const boardAfterOpponentRecapture = cloneBoard(tempBoardForKoCheck);
        newStoneGroup.forEach(s => boardAfterOpponentRecapture[s.r][s.c] = StoneColor.Empty); 

        if (boardsAreEqual(boardAfterOpponentRecapture, originalBoard)) {
           newKoState = {
             koPoint: capturedStonePos, 
             boardSnapshotBeforeKoTrigger: cloneBoard(originalBoard), 
           };
        }
      }
  }

  return { newBoard, stonesCapturedInThisMove, newKoState };
}

export function boardsAreEqual(board1: StoneColor[][], board2: StoneColor[][]): boolean {
  if (!board1 || !board2 || board1.length !== board2.length) return false;
  for (let r = 0; r < board1.length; r++) {
    if (board1[r].length !== board2[r].length) return false;
    for (let c = 0; c < board1[r].length; c++) {
      if (board1[r][c] !== board2[r][c]) return false;
    }
  }
  return true;
}
