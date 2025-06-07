
import { StoneColor, Point, SgfGameInfo, GameTreeNode, FullGameData, KoState, SgfNode } from '../types';
import { DEFAULT_BOARD_SIZE, DEFAULT_KOMI, SGF_MAX_SIZE, HANDICAP_POINTS_19, HANDICAP_POINTS_13, HANDICAP_POINTS_9 } from '../constants';
import { createEmptyBoard, applyMove, cloneBoard } from './goLogic';

// Helper to generate unique enough IDs for nodes
function generateNodeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function sgfCharToCoord(char: string): number {
  if (!char || char.length !== 1) return SGF_MAX_SIZE; // Invalid coord char, place off-board effectively
  return char.charCodeAt(0) - 'a'.charCodeAt(0);
}

export function sgfCoordToPoint(sgfCoord: string): Point | null {
  if (sgfCoord.length === 2) {
    const c = sgfCharToCoord(sgfCoord[0]);
    const r = sgfCharToCoord(sgfCoord[1]);
    // Check if coords are within typical SGF range (up to SGF_MAX_SIZE)
    // Board size check will happen during rendering/application logic
    if (c < SGF_MAX_SIZE && r < SGF_MAX_SIZE && c >=0 && r >=0) {
      return { r, c };
    }
  }
  return null;
}

export function pointToSgfCoord(point: Point): string {
    return String.fromCharCode(97 + point.c) + String.fromCharCode(97 + point.r);
}


// Parses a sequence of SGF nodes and their nested variations.
// Returns an array of SgfNode objects representing the sequence.
function parseSgfNodesRecursive(sgfText: string, indexObj: { i: number }, parentSgfNodeContext: SgfNode | null): SgfNode[] {
  const nodes: SgfNode[] = [];
  let currentParentForSequence = parentSgfNodeContext; // Tracks the SGF parent for sequential linking

  while (indexObj.i < sgfText.length && sgfText[indexObj.i] !== ')') {
    if (sgfText[indexObj.i] === ';') {
      indexObj.i++; // Consume ';'
      const sgfNode: SgfNode = { 
        properties: {}, 
        variations: [], 
        parent: currentParentForSequence, 
        _tempId: generateNodeId() 
      };

      // Parse properties
      while (indexObj.i < sgfText.length && sgfText[indexObj.i] !== '(' && sgfText[indexObj.i] !== ')' && sgfText[indexObj.i] !== ';') {
        let propName = "";
        while (indexObj.i < sgfText.length && sgfText[indexObj.i].match(/[A-Z]/)) {
          propName += sgfText[indexObj.i++];
        }
        if (propName.length === 0) {
          if (sgfText[indexObj.i] !== '[' && sgfText[indexObj.i] !== '(' && sgfText[indexObj.i] !== ')' && sgfText[indexObj.i] !== ';') {
             indexObj.i++; // Skip junk
          }
          continue;
        }
        
        sgfNode.properties[propName] = [];
        while (indexObj.i < sgfText.length && sgfText[indexObj.i] === '[') {
          indexObj.i++; // Consume '['
          let propValue = "";
          let escape = false;
          while (indexObj.i < sgfText.length) {
            if (escape) {
              propValue += sgfText[indexObj.i];
              escape = false;
            } else if (sgfText[indexObj.i] === '\\') {
              escape = true;
            } else if (sgfText[indexObj.i] === ']') {
              break;
            } else {
              propValue += sgfText[indexObj.i];
            }
            indexObj.i++;
          }
          if (indexObj.i < sgfText.length && sgfText[indexObj.i] === ']') indexObj.i++; // Consume ']'
          sgfNode.properties[propName].push(propValue);
        }
      }
      nodes.push(sgfNode);
      currentParentForSequence = sgfNode; // Next node in this sequence will have this sgfNode as its SGF parent.

    } else if (sgfText[indexObj.i] === '(') {
      indexObj.i++; // Consume '('
      const parentForVariation = nodes.length > 0 ? nodes[nodes.length - 1] : parentSgfNodeContext;
      if (parentForVariation) {
        // The result of parsing a variation block is a sequence of SgfNodes.
        // This sequence forms one variation branch.
        const variationSequence = parseSgfNodesRecursive(sgfText, indexObj, parentForVariation);
        if (variationSequence.length > 0) {
            parentForVariation.variations.push(variationSequence);
        }
      } else {
         const orphanedVariationSequence = parseSgfNodesRecursive(sgfText, indexObj, null);
         console.warn("Orphaned variation found:", orphanedVariationSequence);
      }
      if (indexObj.i < sgfText.length && sgfText[indexObj.i] === ')') indexObj.i++; // Consume ')'
    } else {
      indexObj.i++; // Skip unknown characters
    }
  }
  return nodes;
}

// Parses the entire SGF text and returns the primary sequence of SgfNodes for the first game tree.
function parseSgfIntoSequence(sgfText: string): SgfNode[] | null {
  sgfText = sgfText.trim();
  if (!sgfText.startsWith('(') || !sgfText.endsWith(')')) {
    console.warn("SGF does not start/end with parentheses.");
    if (sgfText.startsWith(';')) {
        sgfText = `(${sgfText})`;
    } else {
        console.error("Cannot parse SGF: Not enclosed in parentheses and doesn't start with ';'.");
        return null;
    }
  }
  
  const indexObj = { i: 0 }; 
  while(indexObj.i < sgfText.length && sgfText[indexObj.i] !== '(') indexObj.i++;
  if (indexObj.i >= sgfText.length) {
      console.error("Cannot parse SGF: No '(' found for game tree start.");
      return null;
  }
  indexObj.i++; // Consume '(' of the game tree

  const gameTreeSequence = parseSgfNodesRecursive(sgfText, indexObj, null);
  
  if (gameTreeSequence.length > 0) {
    return gameTreeSequence;
  }
  console.error("No SGF nodes found in the game tree sequence.");
  return null;
}

interface ProcessingContext {
  parentBoard: StoneColor[][];
  parentTotalCapturedB: number;
  parentTotalCapturedW: number;
  parentKoState: KoState;
  parentGameNodeId: string | null;
  currentMoveNumber: number; 
  boardSize: number; 
  currentPlayerFromParent: StoneColor.Black | StoneColor.White; 
}

// Converts a sequence of SgfNodes (and their variations) into GameTreeNodes
function convertSgfSequenceToGameTree(
  sgfSequence: SgfNode[],
  currentIndexInSequence: number,
  context: ProcessingContext,
  allGameNodes: Record<string, GameTreeNode>,
  isRootNodeOfSgf: boolean // True if this is the very first SgfNode in the entire file
): string {
  const sgfNode = sgfSequence[currentIndexInSequence];
  const gameNodeId = sgfNode._tempId || generateNodeId(); // Use tempId if available, otherwise generate.
                                                        // This allows root gameNodeId to match sgfNode._tempId
  
  const props = sgfNode.properties; 

  let currentBoard = cloneBoard(context.parentBoard);
  let stonesCapturedInThisStep: Point[] = [];
  let totalCapturedB = context.parentTotalCapturedB;
  let totalCapturedW = context.parentTotalCapturedW;
  let currentKoState = context.parentKoState;
  let playerForThisNode: StoneColor.Black | StoneColor.White | undefined = undefined;
  let coord: Point | null = null;
  let isActualMove = false;
  let moveNumberForThisNode = context.currentMoveNumber;
  let nextPlayerForChildren = context.currentPlayerFromParent;

  ['AB', 'AW', 'AE'].forEach(propName => {
    if (props[propName]) {
      const color = propName === 'AB' ? StoneColor.Black : (propName === 'AW' ? StoneColor.White : StoneColor.Empty);
      props[propName].forEach(sgfCoordStr => {
        const p = sgfCoordToPoint(sgfCoordStr);
        if (p && p.r < context.boardSize && p.c < context.boardSize) {
            // Allow placing over existing stones for setup properties
            currentBoard[p.r][p.c] = color;
        }
      });
      currentKoState = { koPoint: null, boardSnapshotBeforeKoTrigger: null }; 
    }
  });
  
  if (props['PL']) {
      const plColor = props['PL'][0]?.toUpperCase();
      if (plColor === 'W') nextPlayerForChildren = StoneColor.White;
      else if (plColor === 'B') nextPlayerForChildren = StoneColor.Black;
      currentKoState = { koPoint: null, boardSnapshotBeforeKoTrigger: null }; 
  }

  if (props['B']) {
    playerForThisNode = StoneColor.Black;
    const sgfCoordStr = props['B'][0];
    coord = sgfCoordToPoint(sgfCoordStr);
    if (coord && (coord.r >= context.boardSize || coord.c >= context.boardSize)) coord = null; // tt is pass
    isActualMove = true;
  } else if (props['W']) {
    playerForThisNode = StoneColor.White;
    const sgfCoordStr = props['W'][0];
    coord = sgfCoordToPoint(sgfCoordStr);
    if (coord && (coord.r >= context.boardSize || coord.c >= context.boardSize)) coord = null;
    isActualMove = true;
  }
  
  if (isActualMove && playerForThisNode) {
    if (playerForThisNode !== context.currentPlayerFromParent && context.currentMoveNumber > 0 && !isRootNodeOfSgf) { // Don't warn if root node has PL and then a B/W move
        // Check if there was a PL property on *this* node. If so, it dictates the player.
        let playerDictatedByPL = false;
        if(props['PL']?.[0]?.toUpperCase() === 'B' && playerForThisNode === StoneColor.Black) playerDictatedByPL = true;
        if(props['PL']?.[0]?.toUpperCase() === 'W' && playerForThisNode === StoneColor.White) playerDictatedByPL = true;

        if (!playerDictatedByPL) {
            console.warn(`SGF player order violation at node ${gameNodeId}. Expected ${context.currentPlayerFromParent}, got ${playerForThisNode}. Processing anyway.`);
        }
    }


    if (coord) { 
      const result = applyMove(currentBoard, playerForThisNode, coord, currentKoState);
      if (result.error) {
        console.warn(`SGF ApplyMove Error: ${result.error} for ${playerForThisNode} at (${coord.r}, ${coord.c}). Node: ${gameNodeId}. Board state may be inconsistent.`);
         // If the move is invalid (e.g. suicide, ko), the SGF might intend for the board to NOT change, or for the move to be skipped.
         // For robust parsing, we assume the SGF means what it says and try to apply, but log error.
         // The board state *before* this attempt (currentBoard) would persist if error occurs.
         // However, to match SGF viewers that might skip invalid moves, perhaps don't update board or captures.
         // For now, let's assume SGF implies a valid state, so if applyMove fails, it's an issue with SGF or logic.
         // The current behavior: board not updated, captures not updated, ko not updated. This seems safest.
      } else {
        currentBoard = result.newBoard;
        stonesCapturedInThisStep = result.stonesCapturedInThisMove;
        currentKoState = result.newKoState;

        if (playerForThisNode === StoneColor.Black) totalCapturedB += stonesCapturedInThisStep.length;
        else totalCapturedW += stonesCapturedInThisStep.length;
      }
    } else { // Pass move
      currentKoState = { koPoint: null, boardSnapshotBeforeKoTrigger: null }; 
    }
    moveNumberForThisNode = context.currentMoveNumber + 1;
    nextPlayerForChildren = playerForThisNode === StoneColor.Black ? StoneColor.White : StoneColor.Black;
  }

  const gameTreeNode: GameTreeNode = {
    id: gameNodeId,
    parentId: context.parentGameNodeId,
    childrenIds: [],
    sgfProps: props, 
    player: playerForThisNode,
    coord: coord,
    moveNumber: moveNumberForThisNode, 
    boardState: cloneBoard(currentBoard), 
    stonesCapturedInThisStep: stonesCapturedInThisStep,
    totalCapturedByBlack: totalCapturedB,
    totalCapturedByWhite: totalCapturedW,
    koState: currentKoState,
    comment: props['C']?.[0],
    isMainLineNext: false, 
  };
  allGameNodes[gameNodeId] = gameTreeNode;
  
  const childProcessingContext: ProcessingContext = {
    parentBoard: gameTreeNode.boardState, 
    parentTotalCapturedB: gameTreeNode.totalCapturedByBlack,
    parentTotalCapturedW: gameTreeNode.totalCapturedByWhite,
    parentKoState: gameTreeNode.koState,
    parentGameNodeId: gameNodeId,
    currentMoveNumber: gameTreeNode.moveNumber, 
    boardSize: context.boardSize,
    currentPlayerFromParent: nextPlayerForChildren,
  };

  sgfNode.variations.forEach(variationSequence => {
    if (variationSequence.length > 0) {
      const variationRootGameNodeId = convertSgfSequenceToGameTree(variationSequence, 0, childProcessingContext, allGameNodes, false);
      gameTreeNode.childrenIds.push(variationRootGameNodeId);
    }
  });

  if (currentIndexInSequence + 1 < sgfSequence.length) {
    const mainContinuationGameNodeId = convertSgfSequenceToGameTree(sgfSequence, currentIndexInSequence + 1, childProcessingContext, allGameNodes, false);
    gameTreeNode.childrenIds.unshift(mainContinuationGameNodeId); 
    gameTreeNode.isMainLineNext = true; 
  }
  
  return gameNodeId;
}


export function parseSgf(sgfText: string): FullGameData | null {
  const sgfInitialSequence = parseSgfIntoSequence(sgfText);
  if (!sgfInitialSequence || sgfInitialSequence.length === 0) {
    console.error("Failed to parse SGF into initial sequence.");
    return null;
  }

  const allGameNodes: Record<string, GameTreeNode> = {};
  const rootSgfNode = sgfInitialSequence[0];
  const rootSgfProps = rootSgfNode.properties; 

  let boardSize = DEFAULT_BOARD_SIZE;
  let szPropNode = rootSgfNode; 
  // Some SGFs might have SZ on a child of the root if root is just (;)
  if (!szPropNode.properties['SZ'] && sgfInitialSequence.length > 1 && sgfInitialSequence[1].properties['SZ']) {
      szPropNode = sgfInitialSequence[1];
  } else if (!szPropNode.properties['SZ'] && rootSgfNode.variations.length > 0 && rootSgfNode.variations[0].length > 0 && rootSgfNode.variations[0][0].properties['SZ']){
      szPropNode = rootSgfNode.variations[0][0];
  }


  if (szPropNode.properties['SZ']) {
    const parsedSize = parseInt(szPropNode.properties['SZ'][0]);
    if (!isNaN(parsedSize) && parsedSize > 0) {
        boardSize = parsedSize;
    } else {
        console.warn(`Invalid SZ property: ${szPropNode.properties['SZ'][0]}, defaulting to ${DEFAULT_BOARD_SIZE}.`);
    }
  } else {
    console.warn(`SZ property not found on root SGF node(s), defaulting to ${DEFAULT_BOARD_SIZE}.`);
  }

  if (boardSize > 52 || boardSize < 2) { 
      console.warn(`Board size ${boardSize} is outside typical SGF limits (max 52) or too small, clamping to 19 or using as is if within reasonable parsing limits. App might have issues with very large/small boards.`);
      if (boardSize > 52) { 
        console.error("Board size too large, max 52 supported by SGF spec.");
        return null;
      }
      if (boardSize < 2 && boardSize !== 0) { // Allow 0 as "unknown" for robustness, will default later
         console.error("Board size too small.");
         return null;
      }
      if (boardSize === 0) boardSize = DEFAULT_BOARD_SIZE; // Default if SZ was 0
  }


  const gameInfo: SgfGameInfo = {
    boardSize,
    name: rootSgfProps['GN']?.[0],
    playerBlack: rootSgfProps['PB']?.[0] || 'Black',
    playerWhite: rootSgfProps['PW']?.[0] || 'White',
    rankBlack: rootSgfProps['BR']?.[0],
    rankWhite: rootSgfProps['WR']?.[0],
    date: rootSgfProps['DT']?.[0],
    result: rootSgfProps['RE']?.[0],
    komi: rootSgfProps['KM'] ? parseFloat(rootSgfProps['KM'][0]) : (boardSize >= 19 ? DEFAULT_KOMI : 0), // Komi only if KM exists
    handicap: rootSgfProps['HA'] ? parseInt(rootSgfProps['HA'][0]) : 0,
    ruleset: rootSgfProps['RU']?.[0],
    sgfComment: rootSgfProps['C']?.[0],
    originalRootSgfProps: rootSgfProps,
    parsedRootNodeId: rootSgfNode._tempId,
  };
   if (isNaN(gameInfo.komi as number)) gameInfo.komi = (boardSize >=19 ? DEFAULT_KOMI : 0);
   if (isNaN(gameInfo.handicap as number)) gameInfo.handicap = 0;


  let initialBoard = createEmptyBoard(gameInfo.boardSize);
  let playerToMove = StoneColor.Black; 
  
  if (rootSgfProps['PL']?.[0]?.toUpperCase() === 'W') {
    playerToMove = StoneColor.White;
  }

  // Apply HA only if AB is not present (standard SGF)
  if (gameInfo.handicap && gameInfo.handicap > 0 && !rootSgfProps['AB']) {
    playerToMove = StoneColor.White; 
    const handicapPointSets = gameInfo.boardSize === 19 ? HANDICAP_POINTS_19 :
                             gameInfo.boardSize === 13 ? HANDICAP_POINTS_13 :
                             gameInfo.boardSize === 9  ? HANDICAP_POINTS_9  : {};
    const handicapPoints = (handicapPointSets as Record<number, Point[]>)[gameInfo.handicap];
    
    handicapPoints?.forEach(p => {
      if (p.r < gameInfo.boardSize && p.c < gameInfo.boardSize) {
        initialBoard[p.r][p.c] = StoneColor.Black;
      }
    });
  }
  
  let initialKoStateForRoot: KoState = { koPoint: null, boardSnapshotBeforeKoTrigger: null };
  // Apply root setup stones (AB, AW, AE) AFTER handicap determination
  // These are directly from rootSgfProps which are now also in gameInfo.originalRootSgfProps
  ['AB', 'AW', 'AE'].forEach(propName => {
    if (rootSgfProps[propName]) {
      const color = propName === 'AB' ? StoneColor.Black : (propName === 'AW' ? StoneColor.White : StoneColor.Empty);
      rootSgfProps[propName].forEach(sgfCoordStr => {
        const p = sgfCoordToPoint(sgfCoordStr);
        if (p && p.r < gameInfo.boardSize && p.c < gameInfo.boardSize) {
           initialBoard[p.r][p.c] = color;
        }
      });
      initialKoStateForRoot = { koPoint: null, boardSnapshotBeforeKoTrigger: null }; 
    }
  });


  const initialContext: ProcessingContext = {
    parentBoard: initialBoard,
    parentTotalCapturedB: 0,
    parentTotalCapturedW: 0,
    parentKoState: initialKoStateForRoot,
    parentGameNodeId: null,
    currentMoveNumber: 0, // Root node is move 0 conceptually (setup)
    boardSize: gameInfo.boardSize,
    currentPlayerFromParent: playerToMove, 
  };
  
  // The first SgfNode in the sequence becomes the root GameTreeNode
  const rootGameNodeId = convertSgfSequenceToGameTree(sgfInitialSequence, 0, initialContext, allGameNodes, true);
  
  // The rootGameNodeId should be identical to rootSgfNode._tempId due to how it's generated.
  // gameInfo.parsedRootNodeId already stores rootSgfNode._tempId.
  // If rootSgfNode._tempId (which is gameInfo.parsedRootNodeId) is different from rootGameNodeId (which is used as key in allGameNodes),
  // it implies an issue in ID generation or usage. For now, we assume they are consistent.
  if (gameInfo.parsedRootNodeId !== rootGameNodeId) {
    console.warn(`Mismatch between parsedRootNodeId (${gameInfo.parsedRootNodeId}) and generated rootGameNodeId (${rootGameNodeId}). This might indicate an issue.`);
    // The game will proceed using rootGameNodeId as the key for the tree.
    // gameInfo.parsedRootNodeId keeps the original ID from the SGF node parsing step.
  }

  // Determine initial player for display based on the state *after* the root node is processed.
  const rootProcessedNode = allGameNodes[rootGameNodeId];
  let finalInitialPlayerForDisplay = initialContext.currentPlayerFromParent; // Default
  if (rootProcessedNode) {
      if (rootProcessedNode.player) { // If root node was a move (e.g. B[aa])
          finalInitialPlayerForDisplay = rootProcessedNode.player === StoneColor.Black ? StoneColor.White : StoneColor.Black;
      } else if (rootProcessedNode.childrenIds.length > 0 && allGameNodes[rootProcessedNode.childrenIds[0]]?.player) {
          // If root is setup, look at first child's player
          finalInitialPlayerForDisplay = allGameNodes[rootProcessedNode.childrenIds[0]].player!;
      } else if (rootProcessedNode.sgfProps['PL']) { // Check PL on root node again if no actual move/child move
          const plColor = rootProcessedNode.sgfProps['PL'][0]?.toUpperCase();
          if (plColor === 'W') finalInitialPlayerForDisplay = StoneColor.White;
          else if (plColor === 'B') finalInitialPlayerForDisplay = StoneColor.Black;
      }
  }


  return {
    info: gameInfo,
    rootNodeId: rootGameNodeId,
    nodes: allGameNodes,
    initialPlayerForDisplay: finalInitialPlayerForDisplay
  };
}
