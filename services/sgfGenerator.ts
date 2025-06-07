
import { FullGameData, GameTreeNode, SgfGameInfo, StoneColor } from '../types';
import { DEFAULT_KOMI, DEFAULT_BOARD_SIZE } from '../constants'; // Added imports

const DEFAULT_APP_NAME = "GoBoardSGFViewer_Online"; // Customizable App Name

function escapeSgfValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function formatSingleProperty(key: string, values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  // Ensure values are strings; some might be numbers that need conversion (like KM)
  return `${key}${values.map(v => `[${escapeSgfValue(String(v))}]`).join('')}`;
}

// Suggested order for root properties for readability
const ROOT_PROP_ORDER = [
  'GM', 'FF', 'CA', 'AP', 'ST', 'SZ', 'RU', 'KM', 'HA', 
  'PL', // Player to move is important early
  'DT', 'EV', 'RO', 'PC', 'RE', 'SO', 'GN', 
  'PB', 'PW', 'BR', 'WR', 'BT', 'WT', 
  'TM', 'OT', 'AB', 'AW', 'AE', 'C'
];
// Suggested order for common node properties
const NODE_PROP_ORDER = [
  'B', 'W', 'PL', 'AB', 'AW', 'AE', 'C', 
  'MN', 'N', 'V', 
  'TR', 'SQ', 'CR', 'MA', 'LB', 'SL', 'DD', 'AR', 'LN',
  'DM', 'GB', 'GW', 'UC', 'TE', 'BM', 'DO', 'IT', 'HO'
];

function formatAllProperties(sgfProps: Record<string, string[]>, isRoot: boolean): string {
  let output = "";
  const propsDone = new Set<string>();
  const order = isRoot ? ROOT_PROP_ORDER : NODE_PROP_ORDER;

  order.forEach(key => {
    if (sgfProps[key] && sgfProps[key].length > 0) { // Ensure property has values
      output += formatSingleProperty(key, sgfProps[key]);
      propsDone.add(key);
    }
  });

  for (const key in sgfProps) {
    if (!propsDone.has(key) && sgfProps[key] && sgfProps[key].length > 0) { // Ensure property has values
      output += formatSingleProperty(key, sgfProps[key]);
    }
  }
  return output;
}

function gameTreeToSgfRecursiveInternal(
    currentNodeId: string,
    allNodesInternal: Record<string, GameTreeNode>,
    gameInfoInternal: SgfGameInfo,
    initialPlayerForDisplayFromFullData: StoneColor.Black | StoneColor.White, // Added parameter
    isActualRootSgfNode: boolean 
): string {
    const nodeInternal = allNodesInternal[currentNodeId];
    if (!nodeInternal) return "";

    let sgfSegment = "";

    if (isActualRootSgfNode) {
        sgfSegment += "(;"; 
        const rootProps: Record<string, string[]> = {};
        
        // 1. Start with original SGF properties from the file, if any (deep copy).
        if (gameInfoInternal.originalRootSgfProps) {
            for (const key in gameInfoInternal.originalRootSgfProps) {
                if (gameInfoInternal.originalRootSgfProps[key]) {
                    rootProps[key] = [...gameInfoInternal.originalRootSgfProps[key]];
                }
            }
        }

        // 2. Apply standard SGF headers (these might override original if they were different).
        rootProps['GM'] = ['1'];
        rootProps['FF'] = ['4'];
        rootProps['CA'] = ['UTF-8'];
        rootProps['AP'] = [DEFAULT_APP_NAME]; // Application name/version
        rootProps['ST'] = ['2']; // Style of variation display

        // 3. Apply properties from SgfGameInfo (these reflect current game state/settings, may override).
        if (gameInfoInternal.boardSize) rootProps['SZ'] = [String(gameInfoInternal.boardSize)];
        if (gameInfoInternal.ruleset) rootProps['RU'] = [gameInfoInternal.ruleset];
        // Komi: handle 0 explicitly, format others
        if (gameInfoInternal.komi !== undefined) {
             rootProps['KM'] = [gameInfoInternal.komi % 1 === 0 ? String(gameInfoInternal.komi) : gameInfoInternal.komi.toFixed(1)];
        }

        if (gameInfoInternal.handicap && gameInfoInternal.handicap > 0) rootProps['HA'] = [String(gameInfoInternal.handicap)];
        if (gameInfoInternal.date) rootProps['DT'] = [gameInfoInternal.date];
        if (gameInfoInternal.result) rootProps['RE'] = [gameInfoInternal.result];
        if (gameInfoInternal.name) rootProps['GN'] = [gameInfoInternal.name];
        if (gameInfoInternal.playerBlack) rootProps['PB'] = [gameInfoInternal.playerBlack];
        if (gameInfoInternal.playerWhite) rootProps['PW'] = [gameInfoInternal.playerWhite];
        if (gameInfoInternal.rankBlack) rootProps['BR'] = [gameInfoInternal.rankBlack];
        if (gameInfoInternal.rankWhite) rootProps['WR'] = [gameInfoInternal.rankWhite];
        
        // Set PL (Player to move) based on initialPlayerForDisplay, if not already set by other means.
        // Note: nodeInternal.sgfProps['PL'] will override this if it exists.
        if (initialPlayerForDisplayFromFullData && !rootProps['PL'] && !nodeInternal.sgfProps?.PL) { // Use passed parameter
             rootProps['PL'] = [initialPlayerForDisplayFromFullData === StoneColor.Black ? 'B' : 'W'];
        }
        
        // 4. Apply all properties from the current root GameTreeNode's sgfProps.
        //    These are the live, possibly edited, properties and should take precedence.
        if (nodeInternal.sgfProps) {
            for (const key in nodeInternal.sgfProps) {
                if (nodeInternal.sgfProps[key] && nodeInternal.sgfProps[key].length > 0) {
                    rootProps[key] = [...nodeInternal.sgfProps[key]]; // Deep copy to avoid mutation issues
                } else if (nodeInternal.sgfProps[key] === undefined || (Array.isArray(nodeInternal.sgfProps[key]) && nodeInternal.sgfProps[key].length === 0) ) {
                    // If a property was explicitly emptied or removed in editor, delete it from rootProps
                    delete rootProps[key];
                }
            }
        }
        
        // 5. Special case for root comment from gameInfo.sgfComment (if not already set by nodeInternal.sgfProps.C)
        //    This ensures the game's overall comment (often from SGF header) is preserved if not overridden by an edit on the root node.
        if (gameInfoInternal.sgfComment && (!rootProps['C'] || rootProps['C'].length === 0)) {
            rootProps['C'] = [gameInfoInternal.sgfComment];
        }

        sgfSegment += formatAllProperties(rootProps, true);
    } else {
        sgfSegment += ";";
        sgfSegment += formatAllProperties(nodeInternal.sgfProps, false);
    }

    const childrenInternal = nodeInternal.childrenIds;
    if (childrenInternal.length > 0) {
        if (nodeInternal.isMainLineNext && allNodesInternal[childrenInternal[0]]) {
            // First child is main line
            sgfSegment += gameTreeToSgfRecursiveInternal(childrenInternal[0], allNodesInternal, gameInfoInternal, initialPlayerForDisplayFromFullData, false);
            // Other children are variations
            for (let i = 1; i < childrenInternal.length; i++) {
                if(allNodesInternal[childrenInternal[i]]){
                    sgfSegment += "(";
                    sgfSegment += gameTreeToSgfRecursiveInternal(childrenInternal[i], allNodesInternal, gameInfoInternal, initialPlayerForDisplayFromFullData, false);
                    sgfSegment += ")";
                }
            }
        } else {
            // All children are variations or no specific main line indicated
            childrenInternal.forEach(childId => {
                 if(allNodesInternal[childId]){
                    sgfSegment += "(";
                    sgfSegment += gameTreeToSgfRecursiveInternal(childId, allNodesInternal, gameInfoInternal, initialPlayerForDisplayFromFullData, false);
                    sgfSegment += ")";
                 }
            });
        }
    }

    if (isActualRootSgfNode) {
        sgfSegment += ")"; 
    }
    return sgfSegment;
}

export function generateSgfString(gameData: FullGameData): string {
  if (!gameData || !gameData.rootNodeId || !gameData.nodes[gameData.rootNodeId]) {
    console.warn("SGF Generation: No game data or root node found.");
    // Provide a minimal valid SGF for error case
    let errorKomi = DEFAULT_KOMI;
    try { // gameData might be partially defined
        if (gameData && gameData.info && gameData.info.komi !== undefined) errorKomi = gameData.info.komi;
        else if (gameData && gameData.info && gameData.info.boardSize < 19) errorKomi = 0;
    } catch {}
    return `(;GM[1]FF[4]CA[UTF-8]AP[${DEFAULT_APP_NAME}]SZ[${gameData?.info?.boardSize || DEFAULT_BOARD_SIZE}]KM[${errorKomi}]C[Error: No game data to generate SGF from.])`;
  }
  
  return gameTreeToSgfRecursiveInternal(gameData.rootNodeId, gameData.nodes, gameData.info, gameData.initialPlayerForDisplay, true);
}
