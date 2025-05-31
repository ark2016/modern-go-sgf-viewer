import React, { useState, useEffect, useCallback } from 'react';
import GoBoard from './components/GoBoard';
import Controls from './components/Controls';
import GameInfo from './components/GameInfo';
import CommentsDisplay from './components/CommentsDisplay';
import MoveTreeDisplay from './components/MoveTreeDisplay';
import EditToolbar, { toolDisplayInfo } from './components/EditToolbar'; // Imported toolDisplayInfo
import { StoneColor, Point, SgfGameInfo, FullGameData, KoState, GameTreeNode, LabelInfo, EditTool } from './types';
import { parseSgf, sgfCoordToPoint, pointToSgfCoord as utilPointToSgfCoord } from './services/sgfParser';
import { generateSgfString } from './services/sgfGenerator';
import { createEmptyBoard, applyMove, cloneBoard, getGroupAndLiberties } from './services/goLogic';
import { DEFAULT_BOARD_SIZE, DEFAULT_KOMI } from './constants'; 

// Helper to generate unique IDs for nodes created in edit mode or normal play
function generateDisplayNodeId(): string {
  return 'node-' + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Helper function to parse SGF coordinate list properties (TR[], SQ[], CR[], MA[])
const parseSgfPointList = (propValues: string[] | undefined, boardSize: number): Point[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfCoord) => {
    const point = sgfCoordToPoint(sgfCoord);
    if (point && point.r < boardSize && point.c < boardSize) {
      acc.push(point);
    }
    return acc;
  }, [] as Point[]);
};

// Helper function to parse SGF LB (Label) properties
const parseSgfLabels = (propValues: string[] | undefined, boardSize: number): LabelInfo[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfLabel) => {
    const parts = sgfLabel.split(':');
    if (parts.length === 2) {
      const point = sgfCoordToPoint(parts[0]);
      const text = parts[1];
      if (point && text && point.r < boardSize && point.c < boardSize) {
        acc.push({ point, text });
      }
    }
    return acc;
  }, [] as LabelInfo[]);
};


const App: React.FC = () => {
  const [gameData, setGameData] = useState<FullGameData | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string[]>([]); 

  // Derived states from currentNodeId and gameData
  const [boardState, setBoardState] = useState<StoneColor[][]>(createEmptyBoard(DEFAULT_BOARD_SIZE));
  const [boardSize, setBoardSize] = useState<number>(DEFAULT_BOARD_SIZE);
  const [lastPlayedMoveCoord, setLastPlayedMoveCoord] = useState<Point | null>(null);
  const [currentFullKoState, setCurrentFullKoState] = useState<KoState>({ koPoint: null, boardSnapshotBeforeKoTrigger: null });
  const [currentComment, setCurrentComment] = useState<string | undefined>(undefined);
  const [currentMoveNumber, setCurrentMoveNumber] = useState<number>(0); 
  const [currentPlayerForInfo, setCurrentPlayerForInfo] = useState<StoneColor.Black | StoneColor.White>(StoneColor.Black); 
  
  // Markup states
  const [currentTriangles, setCurrentTriangles] = useState<Point[]>([]);
  const [currentSquares, setCurrentSquares] = useState<Point[]>([]);
  const [currentCircles, setCurrentCircles] = useState<Point[]>([]);
  const [currentMarks, setCurrentMarks] = useState<Point[]>([]); // X-Marks
  const [currentLabels, setCurrentLabels] = useState<LabelInfo[]>([]);

  const [sgfFileName, setSgfFileName] = useState<string | null>(null);
  const [maxMainLineMoveNumber, setMaxMainLineMoveNumber] = useState(0); 


  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [activeEditTool, setActiveEditTool] = useState<EditTool | null>(null);
  const [editModePlayer, setEditModePlayer] = useState<StoneColor.Black | StoneColor.White>(StoneColor.Black); 
  const [editModeCaptures, setEditModeCaptures] = useState<{ black: number; white: number }>({ black: 0, white: 0 });

  
  const updateStateFromNodeId = useCallback((nodeId: string | null, newGameData?: FullGameData | null) => { 
    const dataToUse = newGameData === undefined ? gameData : newGameData; 
    
    if (!dataToUse || !nodeId || !dataToUse.nodes[nodeId]) {
      const initialBoard = dataToUse?.nodes?.[dataToUse.rootNodeId]?.boardState ? cloneBoard(dataToUse.nodes[dataToUse.rootNodeId].boardState) : createEmptyBoard(DEFAULT_BOARD_SIZE);
      const initialSize = dataToUse?.info?.boardSize || DEFAULT_BOARD_SIZE;
      setBoardState(initialBoard);
      setBoardSize(initialSize);
      setLastPlayedMoveCoord(null);
      setCurrentFullKoState({ koPoint: null, boardSnapshotBeforeKoTrigger: null });
      setCurrentComment(dataToUse?.info?.sgfComment);
      setCurrentMoveNumber(0);
      setCurrentPlayerForInfo(dataToUse?.initialPlayerForDisplay || StoneColor.Black);
      setActivePath(dataToUse?.rootNodeId ? [dataToUse.rootNodeId] : []);
      setCurrentNodeId(dataToUse ? dataToUse.rootNodeId : null);
      setCurrentTriangles([]); setCurrentSquares([]); setCurrentCircles([]); setCurrentMarks([]); setCurrentLabels([]);
      return;
    }

    const node = dataToUse.nodes[nodeId];
    if (!node) {
      console.error("Node not found:", nodeId, "Available nodes:", Object.keys(dataToUse.nodes));
      if (dataToUse.rootNodeId && dataToUse.nodes[dataToUse.rootNodeId]) { 
          updateStateFromNodeId(dataToUse.rootNodeId, dataToUse);
      } else { 
          setGameData(null); 
          updateStateFromNodeId(null, null);
      }
      return;
    }
    
    const currentBoardSize = dataToUse.info.boardSize;
    setBoardState(cloneBoard(node.boardState));
    setBoardSize(currentBoardSize); 
    setLastPlayedMoveCoord(node.coord || null);
    setCurrentFullKoState(node.koState || { koPoint: null, boardSnapshotBeforeKoTrigger: null });
    setCurrentComment(node.comment);
    setCurrentMoveNumber(node.moveNumber);
    setCurrentNodeId(nodeId);

    const sgfProps = node.sgfProps || {};
    setCurrentTriangles(parseSgfPointList(sgfProps['TR'], currentBoardSize));
    setCurrentSquares(parseSgfPointList(sgfProps['SQ'], currentBoardSize));
    setCurrentCircles(parseSgfPointList(sgfProps['CR'], currentBoardSize));
    setCurrentMarks(parseSgfPointList(sgfProps['MA'], currentBoardSize));
    setCurrentLabels(parseSgfLabels(sgfProps['LB'], currentBoardSize));

    let nextPlayerToDisplay: StoneColor.Black | StoneColor.White;
    if (node.sgfProps?.PL?.[0]) {
        nextPlayerToDisplay = node.sgfProps.PL[0].toUpperCase() === 'W' ? StoneColor.White : StoneColor.Black;
    } else if (node.player) { 
      nextPlayerToDisplay = node.player === StoneColor.Black ? StoneColor.White : StoneColor.Black;
    } else { 
        if (node.childrenIds.length > 0 && dataToUse.nodes[node.childrenIds[0]]?.player) {
            nextPlayerToDisplay = dataToUse.nodes[node.childrenIds[0]].player!;
        } else { 
            nextPlayerToDisplay = dataToUse.initialPlayerForDisplay; 
        }
    }
    setCurrentPlayerForInfo(nextPlayerToDisplay);

    const path: string[] = [];
    let curr = node;
    while (curr) {
      path.unshift(curr.id);
      if (!curr.parentId) break;
      curr = dataToUse.nodes[curr.parentId];
    }
    setActivePath(path);

  }, [gameData]);

  useEffect(() => {
    if (!gameData) {
        const newGd = createNewGameData();
        setGameData(newGd);
        setSgfFileName(null);
        setMaxMainLineMoveNumber(0);
        updateStateFromNodeId(newGd.rootNodeId, newGd);
    }
  }, [gameData, updateStateFromNodeId]);


  const handleSgfLoad = (sgfText: string, fileName: string) => {
    try {
      const parsedData = parseSgf(sgfText);
      if (parsedData && parsedData.rootNodeId && parsedData.nodes[parsedData.rootNodeId]) {
        setGameData(parsedData);
        setSgfFileName(fileName);
        setIsEditMode(false); 
        setActiveEditTool(null);
        setEditModeCaptures({ black: 0, white: 0 });
        
        let tempNodeId = parsedData.rootNodeId;
        let tempNode = parsedData.nodes[tempNodeId];
        let currentMaxMoves = tempNode.moveNumber;
        const visitedInLoad = new Set<string>();
        while(tempNode && tempNode.childrenIds.length > 0 && !visitedInLoad.has(tempNodeId)) {
            visitedInLoad.add(tempNodeId);
            const firstChildId = tempNode.isMainLineNext ? tempNode.childrenIds[0] : (tempNode.childrenIds.find(id => parsedData.nodes[id]?.isMainLineNext || parsedData.nodes[id]?.moveNumber > tempNode.moveNumber) || tempNode.childrenIds[0]);
            if (parsedData.nodes[firstChildId]) {
                tempNodeId = firstChildId;
                tempNode = parsedData.nodes[tempNodeId];
                currentMaxMoves = Math.max(currentMaxMoves, tempNode.moveNumber);
            } else {
                break; 
            }
        }
        setMaxMainLineMoveNumber(currentMaxMoves);
        updateStateFromNodeId(parsedData.rootNodeId, parsedData);

      } else {
        alert("Failed to parse SGF file. It might be invalid or an unsupported format.");
        setSgfFileName(null);
        setGameData(null);
        setMaxMainLineMoveNumber(0);
        updateStateFromNodeId(null, null); 
      }
    } catch (error) {
      console.error("Error parsing SGF:", error);
      alert(`Error parsing SGF: ${error instanceof Error ? error.message : String(error)}`);
      setSgfFileName(null);
      setGameData(null);
      setMaxMainLineMoveNumber(0);
      updateStateFromNodeId(null, null); 
    }
  };
  
  const navigateToNode = useCallback((nodeId: string, prospectiveGameData?: FullGameData | null) => {
    const dataToUseForNavigation = prospectiveGameData || gameData;
    if (!dataToUseForNavigation) return; 
    updateStateFromNodeId(nodeId, dataToUseForNavigation); 

    if (isEditMode) {
        const selectedNode = dataToUseForNavigation.nodes[nodeId];
        if (selectedNode) {
            let nextPlayerForEdit: StoneColor.Black | StoneColor.White;
            if (selectedNode.sgfProps?.PL?.[0]) {
                 nextPlayerForEdit = selectedNode.sgfProps.PL[0].toUpperCase() === 'W' ? StoneColor.White : StoneColor.Black;
            } else if (selectedNode.player) {
                nextPlayerForEdit = selectedNode.player === StoneColor.Black ? StoneColor.White : StoneColor.Black;
            } else if (selectedNode.childrenIds.length > 0 && dataToUseForNavigation.nodes[selectedNode.childrenIds[0]]?.player) {
                nextPlayerForEdit = dataToUseForNavigation.nodes[selectedNode.childrenIds[0]].player!;
            } else {
                nextPlayerForEdit = dataToUseForNavigation.initialPlayerForDisplay;
            }
            setEditModePlayer(nextPlayerForEdit);
            setCurrentFullKoState(selectedNode.koState || { koPoint: null, boardSnapshotBeforeKoTrigger: null });
        }
    }
  }, [gameData, updateStateFromNodeId, isEditMode]); 

  const handleNavigation = useCallback((target: number | 'first' | 'prev' | 'next' | 'last' | string) => {
    if (!gameData || !currentNodeId) return; 

    const currentNode = gameData.nodes[currentNodeId];
    if (!currentNode) return;

    let targetNodeIdToUpdate: string | null = null;

    if (typeof target === 'string') {
        if (target === 'first') {
            targetNodeIdToUpdate = gameData.rootNodeId;
        } else if (target === 'prev') {
            if (currentNode.parentId) targetNodeIdToUpdate = currentNode.parentId;
        } else if (target === 'next') {
            if (currentNode.childrenIds.length > 0) {
                const currentActiveIndex = activePath.indexOf(currentNodeId);
                const nextInActivePath = (currentActiveIndex !== -1 && currentActiveIndex + 1 < activePath.length) ? activePath[currentActiveIndex + 1] : null;
                
                if (nextInActivePath && currentNode.childrenIds.includes(nextInActivePath)) {
                    targetNodeIdToUpdate = nextInActivePath;
                } else if (currentNode.isMainLineNext && gameData.nodes[currentNode.childrenIds[0]]) { 
                    targetNodeIdToUpdate = currentNode.childrenIds[0];
                } else if (currentNode.childrenIds.length > 0) { 
                     targetNodeIdToUpdate = currentNode.childrenIds[0]; 
                }
            }
        } else if (target === 'last') {
            let lastNodeId = currentNodeId;
            let tempNode = gameData.nodes[lastNodeId];
            const visitedNav = new Set<string>();
            
            const currentActiveIndex = activePath.indexOf(lastNodeId);
            if (currentActiveIndex !== -1 && activePath.length > 0 && gameData.nodes[activePath[activePath.length-1]]) { 
                lastNodeId = activePath[activePath.length -1];
                tempNode = gameData.nodes[lastNodeId];
            }

            while(tempNode && tempNode.childrenIds.length > 0 && !visitedNav.has(lastNodeId)) {
                visitedNav.add(lastNodeId);
                let mainChildId = null;
                if (tempNode.isMainLineNext && gameData.nodes[tempNode.childrenIds[0]]) {
                    mainChildId = tempNode.childrenIds[0];
                } else {
                    mainChildId = tempNode.childrenIds.find(id => activePath.includes(id) && gameData.nodes[id]?.moveNumber > tempNode.moveNumber) || 
                                  tempNode.childrenIds.find(id => gameData.nodes[id]?.moveNumber > tempNode.moveNumber) || 
                                  tempNode.childrenIds[0];
                }

                if(gameData.nodes[mainChildId]){
                    lastNodeId = mainChildId;
                    tempNode = gameData.nodes[mainChildId];
                } else {
                    break;
                }
                if(!tempNode) break;
            }
            targetNodeIdToUpdate = lastNodeId;
        } else { 
             targetNodeIdToUpdate = target; 
        }
    } else if (typeof target === 'number') { 
        const targetMoveNumActual = target + 1; 
        let foundNodeId: string | null = null;

        if (target === -1) { 
            foundNodeId = gameData.rootNodeId;
        } else {
            for (const nodeId of activePath) {
                const node = gameData.nodes[nodeId];
                if (node && node.moveNumber === targetMoveNumActual) {
                    foundNodeId = nodeId;
                    break;
                }
            }
            if (!foundNodeId) {
                 let potentialNodes: string[] = [];
                 for (const nodeId in gameData.nodes) {
                     const node = gameData.nodes[nodeId];
                     if (node.moveNumber === targetMoveNumActual) {
                         potentialNodes.push(nodeId);
                     }
                 }
                 if (potentialNodes.length > 0) {
                    foundNodeId = potentialNodes.sort((a,b) => activePath.includes(b) ? 1 : (activePath.includes(a) ? -1 : 0) )[0] || potentialNodes[0];
                 }
            }
        }
        if (foundNodeId) targetNodeIdToUpdate = foundNodeId;
        else if (target >= maxMainLineMoveNumber -1 && maxMainLineMoveNumber > 0) { 
            handleNavigation('last'); 
            return; 
        }
    }

    if (targetNodeIdToUpdate && gameData.nodes[targetNodeIdToUpdate]) {
        navigateToNode(targetNodeIdToUpdate); 
    }
  }, [gameData, currentNodeId, activePath, maxMainLineMoveNumber, navigateToNode]);

  const createNewGameData = (): FullGameData => {
    const newRootId = generateDisplayNodeId();
    const initialBoardState = createEmptyBoard(DEFAULT_BOARD_SIZE);
    const initialRootNodeSgfProps = {
        C: ["Game created in editor."],
        PL: [StoneColor.Black], 
        SZ: [String(DEFAULT_BOARD_SIZE)],
        KM: [String(DEFAULT_KOMI)],
        AP: ["GoBoardSGFViewer_Online"],
        GM: ["1"], FF: ["4"], CA: ["UTF-8"], ST: ["2"]
    };

    const newGameInfo: SgfGameInfo = {
        name: "New Game",
        boardSize: DEFAULT_BOARD_SIZE,
        komi: DEFAULT_KOMI,
        playerBlack: "Black",
        playerWhite: "White",
        sgfComment: "Game created in editor.",
        originalRootSgfProps: { ...initialRootNodeSgfProps },
        parsedRootNodeId: newRootId, 
    };
    const rootNode: GameTreeNode = {
        id: newRootId,
        parentId: null,
        childrenIds: [],
        sgfProps: { ...initialRootNodeSgfProps }, 
        player: undefined,
        coord: null,
        moveNumber: 0,
        boardState: initialBoardState,
        stonesCapturedInThisStep: [],
        totalCapturedByBlack: 0,
        totalCapturedByWhite: 0,
        koState: { koPoint: null, boardSnapshotBeforeKoTrigger: null },
        isMainLineNext: false,
    };
    return {
        info: newGameInfo,
        rootNodeId: newRootId,
        nodes: { [newRootId]: rootNode },
        initialPlayerForDisplay: StoneColor.Black,
    };
  };

  const handleToggleEditMode = useCallback(() => {
    const enteringEditMode = !isEditMode;
    setIsEditMode(enteringEditMode);

    if (enteringEditMode) {
      setActiveEditTool(EditTool.EDIT_MODE_SELECT);
      
      let currentGd = gameData;
      if (!currentGd) {
          currentGd = createNewGameData();
          setGameData(currentGd);
          setSgfFileName(null); 
          setMaxMainLineMoveNumber(0);
          updateStateFromNodeId(currentGd.rootNodeId, currentGd); 
      }
      
      const nodeToUse = currentGd && currentNodeId ? currentGd.nodes[currentNodeId] : null;
      let initialEditPlayer = currentPlayerForInfo; 
      if (nodeToUse) { 
        if(nodeToUse.sgfProps?.PL?.[0]) {
            initialEditPlayer = nodeToUse.sgfProps.PL[0].toUpperCase() === 'W' ? StoneColor.White : StoneColor.Black;
        } else if (nodeToUse.player) { 
            initialEditPlayer = nodeToUse.player === StoneColor.Black ? StoneColor.White : StoneColor.Black;
        } else if (currentGd?.initialPlayerForDisplay) { 
            initialEditPlayer = currentGd.initialPlayerForDisplay;
        }
      }
      setEditModePlayer(initialEditPlayer);
      setEditModeCaptures({ black: 0, white: 0 }); 
      if (nodeToUse) { 
        setCurrentFullKoState(nodeToUse.koState || { koPoint: null, boardSnapshotBeforeKoTrigger: null });
      }

    } else { 
      setActiveEditTool(null);
      if (gameData && currentNodeId && gameData.nodes[currentNodeId]) {
         setCurrentFullKoState(gameData.nodes[currentNodeId].koState || { koPoint: null, boardSnapshotBeforeKoTrigger: null });
      }
    }
  }, [isEditMode, gameData, currentNodeId, currentPlayerForInfo, updateStateFromNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'SELECT') {
        return; 
      }

      if (event.key === 'F2') {
        event.preventDefault();
        handleToggleEditMode();
        return; 
      }
      
      if (isEditMode) {
        switch(event.key) {
            case 'F4': setActiveEditTool(EditTool.ADD_TRIANGLE); event.preventDefault(); break;
            case 'F5': setActiveEditTool(EditTool.ADD_SQUARE); event.preventDefault(); break;
            case 'F6': setActiveEditTool(EditTool.ADD_CIRCLE); event.preventDefault(); break;
            case 'F7': setActiveEditTool(EditTool.ADD_MARK_X); event.preventDefault(); break;
            case 'F8': setActiveEditTool(EditTool.ADD_LABEL); event.preventDefault(); break;
            case 'F9': setActiveEditTool(EditTool.ADD_NUMBER); event.preventDefault(); break;
            case 'F10': setActiveEditTool(EditTool.ADD_LETTER); event.preventDefault(); break;
            case 'b': case 'B': setActiveEditTool(EditTool.PLACE_BLACK); event.preventDefault(); break;
            case 'w': case 'W': setActiveEditTool(EditTool.PLACE_WHITE); event.preventDefault(); break;
            case 'e': case 'E': case 'Delete': setActiveEditTool(EditTool.REMOVE_STONE); event.preventDefault(); break;
            case 'Escape': setActiveEditTool(EditTool.EDIT_MODE_SELECT); event.preventDefault(); break;
        }
      }

      if (!isEditMode || activeEditTool === EditTool.EDIT_MODE_SELECT || !activeEditTool) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handleNavigation('prev');
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleNavigation('next');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameData, currentNodeId, handleNavigation, handleToggleEditMode, isEditMode, activeEditTool]);

  // Добавляем новую функцию для режима коррекции
  const handleCorrectionMode = (point: Point) => {
    if (!gameData || !currentNodeId) return;
    
    const currentSgfNode = gameData.nodes[currentNodeId];
    if (!currentSgfNode) return;
    
    const sgfCoord = utilPointToSgfCoord(point);
    const newSgfProps = { ...(currentSgfNode.sgfProps || {}) };
    let newBoardForEdit = cloneBoard(currentSgfNode.boardState);
    
    // Определяем текущий цвет камня в этой точке
    const currentStoneColor = newBoardForEdit[point.r][point.c];
    let newColorForPoint: StoneColor;
    
    // Если точка пуста, размещаем камень текущего игрока
    if (currentStoneColor === StoneColor.Empty) {
        newColorForPoint = editModePlayer;
    } 
    // Если камень того же цвета, что и текущий игрок - удаляем его
    else if (currentStoneColor === editModePlayer) {
        newColorForPoint = StoneColor.Empty;
    }
    // Если камень противоположного цвета - заменяем его на камень текущего игрока
    else {
        newColorForPoint = editModePlayer;
    }
    
    // Обновляем доску
    newBoardForEdit[point.r][point.c] = newColorForPoint;
    
    // Обновляем SGF свойства
    ['AB', 'AW', 'AE'].forEach(key => {
        if (newSgfProps[key]) newSgfProps[key] = newSgfProps[key]!.filter(c => c !== sgfCoord);
        if (newSgfProps[key]?.length === 0) delete newSgfProps[key];
    });
    
    if (newColorForPoint !== StoneColor.Empty) {
        const propKey = newColorForPoint === StoneColor.Black ? 'AB' : 'AW';
        if (!newSgfProps[propKey]) newSgfProps[propKey] = [];
        if (!newSgfProps[propKey]!.includes(sgfCoord)) newSgfProps[propKey]!.push(sgfCoord);
    } else {
        if (!newSgfProps['AE']) newSgfProps['AE'] = [];
        if (!newSgfProps['AE']!.includes(sgfCoord)) newSgfProps['AE']!.push(sgfCoord);
    }
    
    delete newSgfProps['B']; delete newSgfProps['W']; // Становится узлом настройки
    
    // Проверяем захват камней, если был поставлен новый камень
    let sessionCapturesDelta = { black: 0, white: 0 };
    if (newColorForPoint !== StoneColor.Empty) {
        const opponentOfPlacedStone = newColorForPoint === StoneColor.Black ? StoneColor.White : StoneColor.Black;
        
        // Проверяем соседние группы камней противника
        const neighbors = [{r:point.r-1,c:point.c},{r:point.r+1,c:point.c},{r:point.r,c:point.c-1},{r:point.r,c:point.c+1}];
        for (const n of neighbors) {
            if (n.r >= 0 && n.r < boardSize && n.c >= 0 && n.c < boardSize && newBoardForEdit[n.r][n.c] === opponentOfPlacedStone) {
                const { group, liberties } = getGroupAndLiberties(newBoardForEdit, n.r, n.c);
                if (liberties.length === 0) {
                    group.forEach(s => {
                        newBoardForEdit[s.r][s.c] = StoneColor.Empty;
                        const capturedSgfCoord = utilPointToSgfCoord(s);
                        if (newSgfProps['AB']) newSgfProps['AB'] = newSgfProps['AB']!.filter(c => c !== capturedSgfCoord);
                        if (newSgfProps['AW']) newSgfProps['AW'] = newSgfProps['AW']!.filter(c => c !== capturedSgfCoord);
                        if (!newSgfProps['AE']) newSgfProps['AE'] = [];
                        if (!newSgfProps['AE']!.includes(capturedSgfCoord)) newSgfProps['AE']!.push(capturedSgfCoord);
                    });
                    if (opponentOfPlacedStone === StoneColor.Black) {
                        sessionCapturesDelta.black += group.length;
                    } else {
                        sessionCapturesDelta.white += group.length;
                    }
                }
            }
        }
        
        // Проверяем, не самоубийственный ли ход
        const { group: ownGroup, liberties: ownLiberties } = getGroupAndLiberties(newBoardForEdit, point.r, point.c);
        if (ownLiberties.length === 0) {
            ownGroup.forEach(s => {
                newBoardForEdit[s.r][s.c] = StoneColor.Empty;
                const selfCapturedSgfCoord = utilPointToSgfCoord(s);
                if (newSgfProps['AB']) newSgfProps['AB'] = newSgfProps['AB']!.filter(c => c !== selfCapturedSgfCoord);
                if (newSgfProps['AW']) newSgfProps['AW'] = newSgfProps['AW']!.filter(c => c !== selfCapturedSgfCoord);
                if (!newSgfProps['AE']) newSgfProps['AE'] = [];
                if (!newSgfProps['AE']!.includes(selfCapturedSgfCoord)) newSgfProps['AE']!.push(selfCapturedSgfCoord);
            });
            if (newColorForPoint === StoneColor.Black) {
                sessionCapturesDelta.white += ownGroup.length;
            } else {
                sessionCapturesDelta.black += ownGroup.length;
            }
        }
    }
    
    // Обновляем счетчик захваченных камней
    setEditModeCaptures(prev => ({ 
        black: prev.black + sessionCapturesDelta.black, 
        white: prev.white + sessionCapturesDelta.white 
    }));
    
    // Переключаем игрока
    const playerForNextEditTurn = editModePlayer === StoneColor.Black ? StoneColor.White : StoneColor.Black;
    newSgfProps['PL'] = [playerForNextEditTurn === StoneColor.Black ? 'B' : 'W'];
    setEditModePlayer(playerForNextEditTurn);
    
    // Создаём обновлённый узел
    const updatedNode: GameTreeNode = { 
        ...currentSgfNode, 
        sgfProps: newSgfProps,
        boardState: newBoardForEdit,
        koState: { koPoint: null, boardSnapshotBeforeKoTrigger: null },
        player: undefined,
        coord: null,
        stonesCapturedInThisStep: [],
    };
    
    // Обновляем игровые данные
    const updatedNodes = { ...gameData.nodes, [currentNodeId]: updatedNode };
    const newFullGameData = {...gameData, nodes: updatedNodes};
    setGameData(newFullGameData);
    
    // Явное обновление состояния доски и других свойств для немедленного отображения изменений
    setBoardState(cloneBoard(newBoardForEdit));
    
    // Обновляем все состояния через updateStateFromNodeId
    updateStateFromNodeId(currentNodeId, newFullGameData);
    
    console.log("Удаление камня завершено");
  };

  // Создаем простую функцию для удаления камней
  const handleStoneRemoval = (point: Point) => {
    if (!gameData || !currentNodeId) return;
    
    const currentSgfNode = gameData.nodes[currentNodeId];
    if (!currentSgfNode) return;
    
    console.log("Удаляем камень/метку в позиции:", point);
    
    // Проверяем, есть ли камень или метка в этой точке
    const hasStone = currentSgfNode.boardState[point.r][point.c] !== StoneColor.Empty;
    const sgfCoord = utilPointToSgfCoord(point);
    const newSgfProps = { ...(currentSgfNode.sgfProps || {}) };
    
    // Проверяем наличие меток в этой точке
    const hasTriangle = currentTriangles.some(p => p.r === point.r && p.c === point.c);
    const hasSquare = currentSquares.some(p => p.r === point.r && p.c === point.c);
    const hasCircle = currentCircles.some(p => p.r === point.r && p.c === point.c);
    const hasMark = currentMarks.some(p => p.r === point.r && p.c === point.c);
    const hasLabel = currentLabels.some(l => l.point.r === point.r && l.point.c === point.c);
    
    const hasAnyMarkup = hasTriangle || hasSquare || hasCircle || hasMark || hasLabel;
    
    // Если нет ни камня, ни метки - ничего не делаем
    if (!hasStone && !hasAnyMarkup) {
        console.log("Нет камня или метки для удаления");
        return;
    }
    
    // Создаем копию доски
    const newBoardForEdit = cloneBoard(currentSgfNode.boardState);
    
    // Удаляем камень, если он есть
    if (hasStone) {
        newBoardForEdit[point.r][point.c] = StoneColor.Empty;
        
        // Удаляем камень из AB/AW и добавляем в AE
        if (newSgfProps['AB']) newSgfProps['AB'] = newSgfProps['AB'].filter(c => c !== sgfCoord);
        if (newSgfProps['AW']) newSgfProps['AW'] = newSgfProps['AW'].filter(c => c !== sgfCoord);
        
        if (!newSgfProps['AE']) newSgfProps['AE'] = [];
        if (!newSgfProps['AE'].includes(sgfCoord)) newSgfProps['AE'].push(sgfCoord);
        
        console.log("Камень удален");
    }
    
    // Удаляем метки, если они есть
    if (hasTriangle) {
        if (newSgfProps['TR']) {
            newSgfProps['TR'] = newSgfProps['TR'].filter(c => c !== sgfCoord);
            if (newSgfProps['TR'].length === 0) delete newSgfProps['TR'];
            console.log("Треугольник удален");
        }
    }
    
    if (hasSquare) {
        if (newSgfProps['SQ']) {
            newSgfProps['SQ'] = newSgfProps['SQ'].filter(c => c !== sgfCoord);
            if (newSgfProps['SQ'].length === 0) delete newSgfProps['SQ'];
            console.log("Квадрат удален");
        }
    }
    
    if (hasCircle) {
        if (newSgfProps['CR']) {
            newSgfProps['CR'] = newSgfProps['CR'].filter(c => c !== sgfCoord);
            if (newSgfProps['CR'].length === 0) delete newSgfProps['CR'];
            console.log("Круг удален");
        }
    }
    
    if (hasMark) {
        if (newSgfProps['MA']) {
            newSgfProps['MA'] = newSgfProps['MA'].filter(c => c !== sgfCoord);
            if (newSgfProps['MA'].length === 0) delete newSgfProps['MA'];
            console.log("Метка X удалена");
        }
    }
    
    if (hasLabel) {
        if (newSgfProps['LB']) {
            newSgfProps['LB'] = newSgfProps['LB'].filter(entry => !entry.startsWith(sgfCoord + ':'));
            if (newSgfProps['LB'].length === 0) delete newSgfProps['LB'];
            console.log("Текстовая метка удалена");
        }
    }
    
    // Создаем обновленный узел
    const updatedNode: GameTreeNode = {
        ...currentSgfNode,
        sgfProps: newSgfProps,
        boardState: newBoardForEdit,
        koState: { koPoint: null, boardSnapshotBeforeKoTrigger: null },
        player: undefined,
        coord: null,
        stonesCapturedInThisStep: [],
    };
    
    // Дополнительная проверка, что доска была обновлена
    console.log("Обновлённый узел создан, проверка доски:", 
                updatedNode.boardState[point.r][point.c] === StoneColor.Empty);
    
    // Обновляем игровые данные
    const updatedNodes = { ...gameData.nodes, [currentNodeId]: updatedNode };
    const newFullGameData = {...gameData, nodes: updatedNodes};
    
    // Обновляем состояние
    console.log("Обновляем состояние игры");
    setGameData(newFullGameData);
    
    // Явное обновление состояния доски и других свойств для немедленного отображения изменений
    setBoardState(cloneBoard(newBoardForEdit));
    
    // Обновляем все состояния через updateStateFromNodeId
    updateStateFromNodeId(currentNodeId, newFullGameData);
    
    console.log("Удаление камня/метки завершено");
  };

  const handleBoardClick = (point: Point) => {
    if (isEditMode) {
        if (!gameData || !currentNodeId) {
            alert("Cannot edit: No game loaded or current node selected.");
            return;
        }
        
        const currentSgfNode = gameData.nodes[currentNodeId];
        if (!currentSgfNode) return;

        const sgfCoord = utilPointToSgfCoord(point);
        
        if (activeEditTool === EditTool.EDIT_MODE_SELECT) {
            const existingStoneOnBoard = currentSgfNode.boardState[point.r][point.c];

            // Если клик на существующий камень - удаляем его
            if (existingStoneOnBoard !== StoneColor.Empty) {
                console.log("Клик на существующий камень в режиме SELECT, удаляем камень");
                handleStoneRemoval(point);
                return;
            }
            
            // Если клик на пустую клетку - делаем ход
            const playerMakingMove = editModePlayer;
            const moveResult = applyMove(currentSgfNode.boardState, playerMakingMove, point, currentFullKoState);

            if (moveResult.error) {
                alert(`Invalid move: ${moveResult.error}`);
                return;
            }

            console.log("Добавляем новый ход в режиме SELECT");
            const newNodeId = generateDisplayNodeId();
            const newMoveNumber = currentSgfNode.moveNumber + 1;

            const newNodeSgfProps: Record<string, string[]> = {
                [playerMakingMove === StoneColor.Black ? 'B' : 'W']: [sgfCoord]
            };
            
            const newNode: GameTreeNode = {
                id: newNodeId,
                parentId: currentNodeId,
                childrenIds: [],
                sgfProps: newNodeSgfProps,
                player: playerMakingMove,
                coord: point,
                moveNumber: newMoveNumber,
                boardState: moveResult.newBoard,
                stonesCapturedInThisStep: moveResult.stonesCapturedInThisMove,
                totalCapturedByBlack: currentSgfNode.totalCapturedByBlack + (playerMakingMove === StoneColor.Black ? moveResult.stonesCapturedInThisMove.length : 0),
                totalCapturedByWhite: currentSgfNode.totalCapturedByWhite + (playerMakingMove === StoneColor.White ? moveResult.stonesCapturedInThisMove.length : 0),
                koState: moveResult.newKoState,
                isMainLineNext: false, 
            };

            const parentNode = { ...gameData.nodes[currentNodeId]! };
            parentNode.childrenIds = [newNodeId, ...parentNode.childrenIds.filter(id => id !== newNodeId)];
            parentNode.isMainLineNext = true; 

            const newNodes = { ...gameData.nodes, [currentNodeId]: parentNode, [newNodeId]: newNode };
            const newFullGameData = { ...gameData, nodes: newNodes };
            setGameData(newFullGameData);

            setEditModePlayer(playerMakingMove === StoneColor.Black ? StoneColor.White : StoneColor.Black);
            const newEditCaptures = { ...editModeCaptures };
            if (playerMakingMove === StoneColor.Black) {
                newEditCaptures.black += moveResult.stonesCapturedInThisMove.length;
            } else {
                newEditCaptures.white += moveResult.stonesCapturedInThisMove.length;
            }
            setEditModeCaptures(newEditCaptures); 
            
            if(parentNode.isMainLineNext && parentNode.childrenIds[0] === newNodeId && newNode.moveNumber > maxMainLineMoveNumber) {
                setMaxMainLineMoveNumber(newNode.moveNumber);
            }
            
            navigateToNode(newNodeId, newFullGameData); 
            return; 

        }
        
        // Logic for specific edit tools (Place Black/White, Erase, Markup)
        const newSgfProps = { ...(currentSgfNode.sgfProps || {}) };
        let updatedNode: GameTreeNode;
        let playerForNextEditTurn = editModePlayer; // Default, can be changed by PL in sgfProps

        switch(activeEditTool) {
            case EditTool.PLACE_BLACK:
            case EditTool.PLACE_WHITE: {
                const stoneColor = activeEditTool === EditTool.PLACE_BLACK ? StoneColor.Black : StoneColor.White;
                
                let boardAfterStoneTool = cloneBoard(currentSgfNode.boardState);
                boardAfterStoneTool[point.r][point.c] = stoneColor;

                // Clear relevant AB/AW/AE for this point, then add the new one
                ['AB', 'AW', 'AE'].forEach(key => {
                    if (newSgfProps[key]) newSgfProps[key] = newSgfProps[key]!.filter(c => c !== sgfCoord);
                    if (newSgfProps[key]?.length === 0) delete newSgfProps[key];
                });

                const propKey = stoneColor === StoneColor.Black ? 'AB' : 'AW';
                if (!newSgfProps[propKey]) newSgfProps[propKey] = [];
                if (!newSgfProps[propKey]!.includes(sgfCoord)) newSgfProps[propKey]!.push(sgfCoord);
                
                delete newSgfProps['B']; delete newSgfProps['W']; // This node becomes a setup node

                let sessionCapturesDelta = { black: 0, white: 0 };
                const opponentOfPlacedStone = stoneColor === StoneColor.Black ? StoneColor.White : StoneColor.Black;
                
                // Обрабатываем захват камней соперника после размещения
                const neighbors = [{r:point.r-1,c:point.c},{r:point.r+1,c:point.c},{r:point.r,c:point.c-1},{r:point.r,c:point.c+1}];
                for (const n of neighbors) {
                    if (n.r >= 0 && n.r < boardSize && n.c >= 0 && n.c < boardSize && boardAfterStoneTool[n.r][n.c] === opponentOfPlacedStone) {
                        const { group, liberties } = getGroupAndLiberties(boardAfterStoneTool, n.r, n.c);
                        if (liberties.length === 0) {
                            group.forEach(s => {
                                boardAfterStoneTool[s.r][s.c] = StoneColor.Empty;
                                const capturedSgfCoord = utilPointToSgfCoord(s);
                                 if (newSgfProps['AB']) newSgfProps['AB'] = newSgfProps['AB']!.filter(c => c !== capturedSgfCoord);
                                 if (newSgfProps['AW']) newSgfProps['AW'] = newSgfProps['AW']!.filter(c => c !== capturedSgfCoord);
                                 if (!newSgfProps['AE']) newSgfProps['AE'] = [];
                                 if (!newSgfProps['AE']!.includes(capturedSgfCoord)) newSgfProps['AE']!.push(capturedSgfCoord);
                                if (opponentOfPlacedStone === StoneColor.Black) sessionCapturesDelta.white++; 
                                else sessionCapturesDelta.black++; 
                            });
                        }
                    }
                }
                // Check for suicide after captures
                const { group: ownGroup, liberties: ownLiberties } = getGroupAndLiberties(boardAfterStoneTool, point.r, point.c);
                if (ownLiberties.length === 0) { 
                    ownGroup.forEach(s => {
                         boardAfterStoneTool[s.r][s.c] = StoneColor.Empty; // Remove self-captured group
                         const selfCapturedSgfCoord = utilPointToSgfCoord(s);
                         if (newSgfProps['AB']) newSgfProps['AB'] = newSgfProps['AB']!.filter(c => c !== selfCapturedSgfCoord);
                         if (newSgfProps['AW']) newSgfProps['AW'] = newSgfProps['AW']!.filter(c => c !== selfCapturedSgfCoord);
                         if (!newSgfProps['AE']) newSgfProps['AE'] = [];
                         if (!newSgfProps['AE']!.includes(selfCapturedSgfCoord)) newSgfProps['AE']!.push(selfCapturedSgfCoord);
                    });
                     // These stones don't count as captures for the opponent in SGF terms, but are removed.
                }
                setEditModeCaptures(prev => ({ black: prev.black + sessionCapturesDelta.black, white: prev.white + sessionCapturesDelta.white }));
                
                updatedNode = {
                    ...currentSgfNode,
                    sgfProps: newSgfProps,
                    boardState: boardAfterStoneTool,
                    koState: { koPoint: null, boardSnapshotBeforeKoTrigger: null }, // Reset Ko for setup
                    player: undefined, // Setup node
                    coord: null,       // Setup node
                    stonesCapturedInThisStep: [], // Setup actions don't count as SGF "move captures"
                };
                break;
            }
            case EditTool.REMOVE_STONE: {
                // Используем новую функцию для удаления камней
                handleStoneRemoval(point);
                return;
            }
            case EditTool.ADD_TRIANGLE:
            case EditTool.ADD_SQUARE:
            case EditTool.ADD_CIRCLE:
            case EditTool.ADD_MARK_X: {
                const propKeyMap = {
                    [EditTool.ADD_TRIANGLE]: 'TR', [EditTool.ADD_SQUARE]: 'SQ',
                    [EditTool.ADD_CIRCLE]: 'CR', [EditTool.ADD_MARK_X]: 'MA',
                } as const;
                const propKey = propKeyMap[activeEditTool as keyof typeof propKeyMap];
                
                let propList = newSgfProps[propKey] ? [...newSgfProps[propKey]] : [];
                const existingIndex = propList.indexOf(sgfCoord);
                if (existingIndex !== -1) {
                    propList.splice(existingIndex, 1); // Toggle off
                } else {
                    propList.push(sgfCoord); // Toggle on
                }
                if (propList.length > 0) newSgfProps[propKey] = propList;
                else delete newSgfProps[propKey];
                
                updatedNode = { ...currentSgfNode, sgfProps: newSgfProps };
                break;
            }
            case EditTool.ADD_LABEL: {
                const existingLabel = currentLabels.find(l => l.point.r === point.r && l.point.c === point.c);
                const labelText = prompt("Enter label text (e.g., A, 1, text):", existingLabel ? existingLabel.text : "");
                
                if (labelText !== null) { // User didn't cancel prompt
                    let lbList = newSgfProps['LB'] ? [...newSgfProps['LB']] : [];
                    const coordPrefix = sgfCoord + ':';
                    lbList = lbList.filter(item => !item.startsWith(coordPrefix)); // Remove existing label for this coordinate

                    if (labelText !== "") { // If new text is provided, add it
                        lbList.push(`${sgfCoord}:${labelText}`);
                    }
                    // If labelText is empty, it means remove the label, which filter already did.
                    
                    if (lbList.length > 0) newSgfProps['LB'] = lbList;
                    else delete newSgfProps['LB'];
                }
                updatedNode = { ...currentSgfNode, sgfProps: newSgfProps };
                break;
            }
            case EditTool.ADD_NUMBER: {
                // Считаем уже существующие числовые метки, чтобы определить следующий номер
                let nextNumber = 1;
                if (newSgfProps['LB']) {
                    const existingNumbers = newSgfProps['LB']
                        .map(label => {
                            const parts = label.split(':');
                            return parts.length === 2 ? parseInt(parts[1]) : NaN;
                        })
                        .filter(num => !isNaN(num));
                    
                    if (existingNumbers.length > 0) {
                        nextNumber = Math.max(...existingNumbers) + 1;
                    }
                }
                
                // Проверяем, есть ли уже метка в этой точке
                let lbList = newSgfProps['LB'] ? [...newSgfProps['LB']] : [];
                const coordPrefix = sgfCoord + ':';
                lbList = lbList.filter(item => !item.startsWith(coordPrefix)); // Удаляем существующую метку для этой координаты
                
                // Добавляем новую числовую метку
                lbList.push(`${sgfCoord}:${nextNumber}`);
                
                if (lbList.length > 0) newSgfProps['LB'] = lbList;
                else delete newSgfProps['LB'];
                
                updatedNode = { ...currentSgfNode, sgfProps: newSgfProps };
                break;
            }
            case EditTool.ADD_LETTER: {
                // Считаем уже существующие буквенные метки, чтобы определить следующую букву
                let nextLetterCode = 'A'.charCodeAt(0);
                if (newSgfProps['LB']) {
                    const existingLetters = newSgfProps['LB']
                        .map(label => {
                            const parts = label.split(':');
                            // Берем только одиночные буквы A-Z
                            return parts.length === 2 && parts[1].length === 1 && 
                                   parts[1] >= 'A' && parts[1] <= 'Z' ? parts[1] : null;
                        })
                        .filter(letter => letter !== null);
                    
                    if (existingLetters.length > 0) {
                        // Находим букву с максимальным кодом и берем следующую
                        const maxLetterCode = Math.max(...existingLetters.map(letter => letter!.charCodeAt(0)));
                        nextLetterCode = maxLetterCode + 1;
                        // Если дошли до конца алфавита, начинаем сначала
                        if (nextLetterCode > 'Z'.charCodeAt(0)) {
                            nextLetterCode = 'A'.charCodeAt(0);
                        }
                    }
                }
                
                // Преобразуем код символа обратно в букву
                const nextLetter = String.fromCharCode(nextLetterCode);
                
                // Проверяем, есть ли уже метка в этой точке
                let lbList = newSgfProps['LB'] ? [...newSgfProps['LB']] : [];
                const coordPrefix = sgfCoord + ':';
                lbList = lbList.filter(item => !item.startsWith(coordPrefix)); // Удаляем существующую метку для этой координаты
                
                // Добавляем новую буквенную метку
                lbList.push(`${sgfCoord}:${nextLetter}`);
                
                if (lbList.length > 0) newSgfProps['LB'] = lbList;
                else delete newSgfProps['LB'];
                
                updatedNode = { ...currentSgfNode, sgfProps: newSgfProps };
                break;
            }
            default: return; 
        }
        
        if (newSgfProps['PL']?.[0]) {
            playerForNextEditTurn = newSgfProps['PL'][0].toUpperCase() === 'W' ? StoneColor.White : StoneColor.Black;
        }
        setEditModePlayer(playerForNextEditTurn);

        const updatedNodes = { ...gameData.nodes, [currentNodeId]: updatedNode };
        const newFullGameData = {...gameData, nodes: updatedNodes};
        setGameData(newFullGameData);
        updateStateFromNodeId(currentNodeId, newFullGameData);

    } else { 
        if (!gameData || !currentNodeId ) {
             alert("Error: Game not initialized for play. Please try refreshing or loading an SGF.");
             return;
        }
        
        if (gameData.info.name === "New Game") {
            const currentSgfNode = gameData.nodes[currentNodeId];
            if (!currentSgfNode) {
                alert("Error: Current game node is missing.");
                return;
            }

            if (currentSgfNode.boardState[point.r]?.[point.c] !== StoneColor.Empty) {
                return;
            }

            const playerMakingMove = currentPlayerForInfo; 
            const moveResult = applyMove(currentSgfNode.boardState, playerMakingMove, point, currentFullKoState);

            if (moveResult.error) {
                alert(`Invalid move: ${moveResult.error}`);
                return;
            }

            const newNodeId = generateDisplayNodeId();
            const newMoveNumber = currentSgfNode.moveNumber + 1;
            const sgfCoord = utilPointToSgfCoord(point);

            const newNodeSgfProps: Record<string, string[]> = {
                [playerMakingMove === StoneColor.Black ? 'B' : 'W']: [sgfCoord]
            };

            const newNode: GameTreeNode = {
                id: newNodeId,
                parentId: currentNodeId,
                childrenIds: [],
                sgfProps: newNodeSgfProps,
                player: playerMakingMove,
                coord: point,
                moveNumber: newMoveNumber,
                boardState: moveResult.newBoard,
                stonesCapturedInThisStep: moveResult.stonesCapturedInThisMove,
                totalCapturedByBlack: currentSgfNode.totalCapturedByBlack + (playerMakingMove === StoneColor.Black ? moveResult.stonesCapturedInThisMove.length : 0),
                totalCapturedByWhite: currentSgfNode.totalCapturedByWhite + (playerMakingMove === StoneColor.White ? moveResult.stonesCapturedInThisMove.length : 0),
                koState: moveResult.newKoState,
                isMainLineNext: false,
            };

            const parentNode = { ...gameData.nodes[currentNodeId]! };
            parentNode.childrenIds = [newNodeId, ...parentNode.childrenIds.filter(id => id !== newNodeId)];
            parentNode.isMainLineNext = true;

            const newNodes = { ...gameData.nodes, [currentNodeId]: parentNode, [newNodeId]: newNode };
            const newFullGameData = { ...gameData, nodes: newNodes };
            setGameData(newFullGameData);
            
            if(parentNode.isMainLineNext && parentNode.childrenIds[0] === newNodeId && newNode.moveNumber > maxMainLineMoveNumber) {
                setMaxMainLineMoveNumber(newNode.moveNumber);
            }
            navigateToNode(newNodeId, newFullGameData);
        }
    }
  };

  const handleDownloadSgf = () => {
    if (!gameData) return;
    const sgfContent = generateSgfString(gameData);
    const filename = sgfFileName 
      ? sgfFileName.replace(/\.sgf$/i, '') + "_modified.sgf" 
      : (gameData.info.name && gameData.info.name !== "New Game" ? gameData.info.name.replace(/ /g, '_') : "edited_game") + ".sgf";

    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/x-go-sgf;charset=utf-8,' + encodeURIComponent(sgfContent));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const currentSgfNodeForInfo = gameData && currentNodeId ? gameData.nodes[currentNodeId] : null;
  const currentMoveIndexForSlider = currentSgfNodeForInfo ? (currentSgfNodeForInfo.moveNumber > 0 ? currentSgfNodeForInfo.moveNumber -1 : -1) : -1;

  const getCellSize = (bs: number) => {
    if (bs <= 9) return 38;
    if (bs <= 13) return 32;
    if (bs <= 19) return 28;
    return 24; 
  };
  
  let totalMovesForControls = maxMainLineMoveNumber;
  if (isEditMode && (!sgfFileName || gameData?.info?.name === "New Game")) {
    if (currentSgfNodeForInfo && currentSgfNodeForInfo.moveNumber > totalMovesForControls) {
        totalMovesForControls = currentSgfNodeForInfo.moveNumber;
    }
    if (totalMovesForControls === 0 && currentSgfNodeForInfo?.childrenIds?.length > 0 && gameData) {
        let maxChildMove = 0;
        const q = [...(currentSgfNodeForInfo.childrenIds || [])];
        const visited = new Set<string>();
        while(q.length > 0) {
            const childId = q.shift()!;
            if (visited.has(childId) || !gameData.nodes[childId]) continue;
            visited.add(childId);
            maxChildMove = Math.max(maxChildMove, gameData.nodes[childId].moveNumber);
            q.push(...(gameData.nodes[childId].childrenIds || []));
        }
        totalMovesForControls = maxChildMove;
    }
  }


  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-4 px-2 sm:px-4 lg:px-6 text-gray-800 dark:text-gray-200">
      <header className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100">Go Board SGF Viewer</h1>
      </header>

      <div className="max-w-full mx-auto grid grid-cols-1 lg:grid-cols-[minmax(300px,auto)_1fr_minmax(280px,auto)] gap-4">
        <div className="space-y-4 order-1 lg:order-none">
          <Controls
            onSgfLoad={handleSgfLoad}
            currentMove={currentMoveIndexForSlider} 
            totalMoves={totalMovesForControls} 
            onNavigate={handleNavigation}
            fileName={sgfFileName}
            isEditMode={isEditMode}
            onToggleEditMode={handleToggleEditMode}
            onDownloadSgf={handleDownloadSgf}
            canDownload={!!gameData}
          />
          {isEditMode && (
            <EditToolbar 
              activeTool={activeEditTool} 
              onToolSelect={setActiveEditTool} 
            />
          )}
          <GameInfo 
            info={gameData?.info || (isEditMode ? { boardSize: DEFAULT_BOARD_SIZE, name: "New Game"} as SgfGameInfo : null)}
            currentMoveData={ currentSgfNodeForInfo ? { 
                id: currentSgfNodeForInfo.id,
                player: currentSgfNodeForInfo.player!, coord: currentSgfNodeForInfo.coord || null, comment: currentSgfNodeForInfo.comment,
                boardStateAfterMove: currentSgfNodeForInfo.boardState, stonesCapturedInThisMove: currentSgfNodeForInfo.stonesCapturedInThisStep,
                totalCapturedByBlack: currentSgfNodeForInfo.totalCapturedByBlack, totalCapturedByWhite: currentSgfNodeForInfo.totalCapturedByWhite,
                koStateAfterMove: currentSgfNodeForInfo.koState, moveNumber: currentSgfNodeForInfo.moveNumber
            } : null}
            currentPlayerTurn={isEditMode ? editModePlayer : currentPlayerForInfo} 
            isEditMode={isEditMode}
            editModePlayerTurn={isEditMode ? editModePlayer : undefined} 
            editModeCaptures={isEditMode ? editModeCaptures : undefined}
          />
          {!isEditMode && currentSgfNodeForInfo && <CommentsDisplay comment={currentSgfNodeForInfo.comment} />}
        </div>

        <div className="flex flex-col items-center justify-start order-first lg:order-none">
           <div className="bg-white dark:bg-gray-800 p-2 sm:p-4 rounded-lg shadow-xl inline-block">
             <GoBoard
                boardSize={boardSize}
                boardState={boardState}
                lastMove={lastPlayedMoveCoord}
                koPoint={currentFullKoState.koPoint} 
                onIntersectionClick={handleBoardClick} 
                cellSize={getCellSize(boardSize)}
                triangles={currentTriangles}
                squares={currentSquares}
                circles={currentCircles}
                marks={currentMarks}
                labels={currentLabels}
              />
           </div>
           {isEditMode && activeEditTool && toolDisplayInfo[activeEditTool] &&
             <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Active Tool: {toolDisplayInfo[activeEditTool]?.label || 'Select'}. Click to interact.</p>
           }
           {!isEditMode && gameData?.info.name === "New Game" &&
             <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Click on the board to play a move.</p>
           }
        </div>
        
        <div className="order-last lg:order-none">
            {gameData && gameData.rootNodeId && (
                <MoveTreeDisplay 
                    nodes={gameData.nodes}
                    rootId={gameData.rootNodeId}
                    activeNodeId={currentNodeId}
                    onNodeSelect={(nodeId) => navigateToNode(nodeId)} 
                    isEditMode={isEditMode}
                    boardSize={gameData.info.boardSize} 
                    activePath={activePath} 
                />
            )}
        </div>
      </div>
      
      <footer className="text-center mt-12 py-4 text-gray-600 dark:text-gray-300 text-sm">
        Go Board SGF Viewer - Advanced Baduk/Weiqi Experience
      </footer>
    </div>
  );
};

export default App;
