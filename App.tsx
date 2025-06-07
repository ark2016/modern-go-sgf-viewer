import React, { useState, useEffect, useCallback, useRef } from 'react';
import GoBoard from './components/GoBoard';
import Controls from './components/Controls';
import GameInfo from './components/GameInfo';
import CommentsDisplay from './components/CommentsDisplay';
import MoveTreeDisplay from './components/MoveTreeDisplay';
import EditToolbar, { toolDisplayInfo } from './components/EditToolbar'; // Imported toolDisplayInfo
import { StoneColor, Point, SgfGameInfo, FullGameData, KoState, GameTreeNode, LabelInfo, EditTool, DrawingLine, DrawingArrow, DrawingMode, DrawingPath } from './types';
import { parseSgf, sgfCoordToPoint, pointToSgfCoord as utilPointToSgfCoord } from './services/sgfParser';
import { generateSgfString } from './services/sgfGenerator';
import { createEmptyBoard, applyMove, cloneBoard, getGroupAndLiberties } from './services/goLogic';
import { DEFAULT_BOARD_SIZE, DEFAULT_KOMI } from './constants'; 
import EmojiPicker from './components/EmojiPicker';
import CreateGameModal, { GameSettings } from './components/CreateGameModal';
import TimeClock from './components/TimeClock';
import GameControls from './components/GameControls';

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
const parseSgfLabels = (propValues: string[] | undefined, boardSize: number, emojiPoints?: string[]): LabelInfo[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfLabel) => {
    const parts = sgfLabel.split(':');
    if (parts.length === 2) {
      const point = sgfCoordToPoint(parts[0]);
      const text = parts[1];
      if (point && text && point.r < boardSize && point.c < boardSize) {
        // Проверяем, является ли эта метка эмодзи
        const isEmoji = emojiPoints?.includes(parts[0]) || false;
        acc.push({ 
          point, 
          text,
          isEmoji,
          position: isEmoji ? 'topRight' : 'center'
        });
      }
    }
    return acc;
  }, [] as LabelInfo[]);
};

// Функция для парсинга линий из SGF
const parseSgfLinesList = (propValues: string[] | undefined, boardSize: number): DrawingLine[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfLine) => {
    const parts = sgfLine.split(':');
    if (parts.length === 2) {
      const startPoint = sgfCoordToPoint(parts[0]);
      const endPoint = sgfCoordToPoint(parts[1]);
      if (startPoint && endPoint && 
          startPoint.r < boardSize && startPoint.c < boardSize && 
          endPoint.r < boardSize && endPoint.c < boardSize) {
        
        // Проверяем, есть ли цвет для этой линии
        let color = "#FF4500"; // По умолчанию оранжево-красный
        if (gameData && currentNodeId && gameData.nodes[currentNodeId]?.sgfProps?.['CL']) {
          const colorEntry = gameData.nodes[currentNodeId].sgfProps['CL'].find(entry => entry.startsWith(sgfLine + ':'));
          if (colorEntry) {
            const parts = colorEntry.split(':');
            if (parts.length > 2) {
              color = parts[2];
            }
          }
        }
        
        acc.push({
          start: startPoint,
          end: endPoint,
          color,
          thickness: Math.max(2, getCellSize(boardSize) / 12)
        });
      }
    }
    return acc;
  }, [] as DrawingLine[]);
};

// Функция для парсинга стрелок из SGF
const parseSgfArrowsList = (propValues: string[] | undefined, boardSize: number): DrawingArrow[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfArrow) => {
    const parts = sgfArrow.split(':');
    if (parts.length === 2) {
      const startPoint = sgfCoordToPoint(parts[0]);
      const endPoint = sgfCoordToPoint(parts[1]);
      if (startPoint && endPoint && 
          startPoint.r < boardSize && startPoint.c < boardSize && 
          endPoint.r < boardSize && endPoint.c < boardSize) {
        
        // Проверяем, есть ли цвет для этой стрелки
        let color = "#FF4500"; // По умолчанию оранжево-красный
        if (gameData && currentNodeId && gameData.nodes[currentNodeId]?.sgfProps?.['CA']) {
          const colorEntry = gameData.nodes[currentNodeId].sgfProps['CA'].find(entry => entry.startsWith(sgfArrow + ':'));
          if (colorEntry) {
            const parts = colorEntry.split(':');
            if (parts.length > 2) {
              color = parts[2];
            }
          }
        }
        
        acc.push({
          start: startPoint,
          end: endPoint,
          color,
          thickness: Math.max(2, getCellSize(boardSize) / 12)
        });
      }
    }
    return acc;
  }, [] as DrawingArrow[]);
};

// Функция для парсинга путей из SGF
const parseSgfPathsList = (propValues: string[] | undefined, boardSize: number): DrawingPath[] => {
  if (!propValues) return [];
  return propValues.reduce((acc, sgfPath) => {
    // Каждые 2 символа - это одна SGF координата
    const points: Point[] = [];
    for (let i = 0; i < sgfPath.length; i += 2) {
      if (i + 1 < sgfPath.length) {
        const sgfCoord = sgfPath.substring(i, i + 2);
        const point = sgfCoordToPoint(sgfCoord);
        if (point && point.r < boardSize && point.c < boardSize) {
          points.push(point);
        }
      }
    }
    
    // Определяем цвет пути
    let color = "#FF4500"; // По умолчанию оранжево-красный
    if (gameData && currentNodeId && gameData.nodes[currentNodeId]?.sgfProps?.['ZC']) {
      const pathStart = sgfPath.substring(0, 4); // Берем первые две координаты как идентификатор
      const colorEntry = gameData.nodes[currentNodeId].sgfProps['ZC'].find(entry => entry.startsWith(pathStart + ':'));
      if (colorEntry) {
        const parts = colorEntry.split(':');
        if (parts.length === 2) {
          color = parts[1];
        }
      }
    }
    
    if (points.length >= 2) {
      acc.push({
        points,
        color,
        thickness: Math.max(2, getCellSize(boardSize) / 12)
      });
    }
    
    return acc;
  }, [] as DrawingPath[]);
};

// Функция для определения, используется ли мобильное устройство
const useMobileDetect = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // 768px - стандартная точка для мобильных устройств
    };
    
    checkMobile(); // Проверка при загрузке
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  return isMobile;
};

const getCellSize = (bs: number, isMobile: boolean) => {
  // Для мобильных устройств - динамический расчет размера ячейки
  if (isMobile) {
    // Вернем примерные размеры, точный размер будет установлен динамически
    if (bs <= 9) return 28;
    if (bs <= 13) return 22;
    if (bs <= 19) return 16;
    return 14;
  } else {
    // Оригинальные размеры для десктопов
    if (bs <= 9) return 38;
    if (bs <= 13) return 32;
    if (bs <= 19) return 28;
    return 24; 
  }
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

  
  // Состояния для рисования
  const [currentLines, setCurrentLines] = useState<DrawingLine[]>([]);
  const [currentArrows, setCurrentArrows] = useState<DrawingArrow[]>([]);
  const [currentPaths, setCurrentPaths] = useState<DrawingPath[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);
  const [drawingEndPoint, setDrawingEndPoint] = useState<Point | null>(null);
  const [currentDrawingType, setCurrentDrawingType] = useState<DrawingMode>(DrawingMode.NONE);
  const [temporaryDrawing, setTemporaryDrawing] = useState<DrawingLine | DrawingArrow | null>(null);
  const [currentFreehandPath, setCurrentFreehandPath] = useState<Point[]>([]);
  // Добавляем состояние для цвета рисования
  const [currentDrawingColor, setCurrentDrawingColor] = useState<string>("#FF4500"); // Оранжево-красный по умолчанию

  // Внутри компонента App добавляем новые состояния для работы с EmojiPicker
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [currentEmojiPoint, setCurrentEmojiPoint] = useState<Point | null>(null);
  
  // Состояние для модального окна создания игры
  const [isCreateGameModalOpen, setIsCreateGameModalOpen] = useState<boolean>(false);

  const isMobile = useMobileDetect();
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [mobileCellSize, setMobileCellSize] = useState<number | null>(null);

  // Состояния для управления часами
  const [timeControlEnabled, setTimeControlEnabled] = useState<boolean>(false);
  const [mainTimeInSeconds, setMainTimeInSeconds] = useState<number>(0);
  const [byoyomiInSeconds, setByoyomiInSeconds] = useState<number>(0);
  const [byoyomiPeriods, setByoyomiPeriods] = useState<number>(0);
  const [isClockActive, setIsClockActive] = useState<boolean>(false);

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
      setCurrentLines([]); setCurrentArrows([]); setCurrentPaths([]); // Очищаем все рисунки
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
    setCurrentLabels(parseSgfLabels(sgfProps['LB'], currentBoardSize, sgfProps['EM']));
    
    // Загружаем линии, стрелки и пути
    setCurrentLines(parseSgfLinesList(sgfProps['LN'], currentBoardSize));
    setCurrentArrows(parseSgfArrowsList(sgfProps['AR'], currentBoardSize));
    setCurrentPaths(parseSgfPathsList(sgfProps['ZZ'], currentBoardSize)); // ZZ - кастомное свойство для путей

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

  const createNewGameData = (gameSettings?: GameSettings): FullGameData => {
    const newRootId = generateDisplayNodeId();
    const boardSize = gameSettings?.boardSize || DEFAULT_BOARD_SIZE;
    const komi = gameSettings?.komi || DEFAULT_KOMI;
    const handicap = gameSettings?.handicap || 0;
    const initialBoardState = createEmptyBoard(boardSize);
    
    // Определяем, какой игрок ходит первым, на основе настроек
    const initialPlayer = (handicap > 0) ? StoneColor.White : StoneColor.Black;
    
    const initialRootNodeSgfProps: Record<string, string[]> = {
        C: ["Game created in Modern Go SGF Viewer."],
        PL: [initialPlayer], 
        SZ: [String(boardSize)],
        KM: [String(komi)],
        AP: ["GoBoardSGFViewer_Online"],
        GM: ["1"], FF: ["4"], CA: ["UTF-8"], ST: ["2"]
    };
    
    // Добавляем handicap, если он указан
    if (handicap > 0) {
        initialRootNodeSgfProps.HA = [String(handicap)];
        
        // Добавляем начальные камни для handicap
        let handicapPoints: { r: number; c: number }[] = [];
        if (boardSize === 19) {
            handicapPoints = HANDICAP_POINTS_19[handicap] || [];
        } else if (boardSize === 13) {
            handicapPoints = HANDICAP_POINTS_13[handicap] || [];
        } else if (boardSize === 9) {
            handicapPoints = HANDICAP_POINTS_9[handicap] || [];
        }
        
        if (handicapPoints.length > 0) {
            initialRootNodeSgfProps.AB = handicapPoints.map(p => utilPointToSgfCoord(p));
            
            // Расставляем камни на доске
            handicapPoints.forEach(p => {
                initialBoardState[p.r][p.c] = StoneColor.Black;
            });
        }
    }
    
    // Если включены настройки времени, сохраняем их
    if (gameSettings?.timeSettings?.enabled) {
      setTimeControlEnabled(true);
      setMainTimeInSeconds(gameSettings.timeSettings.mainTime * 60); // Конвертируем минуты в секунды
      setByoyomiInSeconds(gameSettings.timeSettings.byoyomi);
      setByoyomiPeriods(gameSettings.timeSettings.periods);
    } else {
      setTimeControlEnabled(false);
    }

    const newGameInfo: SgfGameInfo = {
        name: "Новая игра",
        boardSize: boardSize,
        komi: komi,
        handicap: handicap,
        playerBlack: gameSettings?.playerBlack || "Черные",
        playerWhite: gameSettings?.playerWhite || "Белые",
        rankBlack: gameSettings?.rankBlack || "",
        rankWhite: gameSettings?.rankWhite || "",
        sgfComment: "Игра создана в Modern Go SGF Viewer.",
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
        initialPlayerForDisplay: initialPlayer,
    };
  };
  
  // Обработчик создания новой игры
  const handleCreateGame = (gameSettings: GameSettings) => {
    try {
      // Создаем новую игру с указанными настройками
      const newGameData = createNewGameData(gameSettings);
      
      // Обновляем состояние приложения
      setGameData(newGameData);
      setSgfFileName(null);
      setMaxMainLineMoveNumber(0);
      updateStateFromNodeId(newGameData.rootNodeId, newGameData);
      
      // Если пользователь выбрал белый цвет, то он играет за белых, иначе за черных
      if (gameSettings.playerColor === StoneColor.White) {
        setEditModePlayer(StoneColor.White);
      } else {
        setEditModePlayer(StoneColor.Black);
      }
      
      // Включаем режим редактирования
      setIsEditMode(true);
      setActiveEditTool(EditTool.EDIT_MODE_SELECT);
      setEditModeCaptures({ black: 0, white: 0 });
      
      // Сбрасываем состояние часов
      if (gameSettings.timeSettings?.enabled) {
        setTimeControlEnabled(true);
        setMainTimeInSeconds(gameSettings.timeSettings.mainTime * 60); // Конвертируем минуты в секунды
        setByoyomiInSeconds(gameSettings.timeSettings.byoyomi);
        setByoyomiPeriods(gameSettings.timeSettings.periods);
        setIsClockActive(false); // Изначально часы остановлены
      } else {
        setTimeControlEnabled(false);
        setIsClockActive(false);
      }
      
      // Явно закрываем модальное окно перед выходом из функции
      setTimeout(() => {
        setIsCreateGameModalOpen(false);
      }, 0);
    } catch (error) {
      console.error("Ошибка при создании игры:", error);
      alert("Произошла ошибка при создании игры. Пожалуйста, попробуйте снова.");
    }
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
      
      // Обработка навигации по ходам с помощью стрелок (всегда работает)
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleNavigation('prev');
        return;
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNavigation('next');
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleNavigation('first');
        return;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleNavigation('last');
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
            case 'f': case 'F': setActiveEditTool(EditTool.DRAW_FREEHAND); event.preventDefault(); break;
            case 'l': case 'L': setActiveEditTool(EditTool.DRAW_LINE); event.preventDefault(); break;
            case 'a': case 'A': setActiveEditTool(EditTool.DRAW_ARROW); event.preventDefault(); break;
            case 'x': case 'X': setActiveEditTool(EditTool.REMOVE_DRAWING); event.preventDefault(); break;
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
            // These stones don't count as captures for the opponent in SGF terms, but are removed.
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
    if (isDrawingMode) {
      return;
    }

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

            // Переключаем активного игрока
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
                
                // Устанавливаем позицию для пикера эмодзи
                const boardElement = document.querySelector('.go-board-bg');
                if (boardElement) {
                    const rect = boardElement.getBoundingClientRect();
                    // Для каждой точки находим ее координаты на экране
                    const cellSize = getCellSize(boardSize, isMobile);
                    const padding = cellSize / 2;
                    const pointX = rect.left + padding + point.c * cellSize;
                    const pointY = rect.top + padding + point.r * cellSize;
                    
                    // Открываем пикер эмодзи
                    setEmojiPickerPosition({ x: pointX, y: pointY });
                    setIsEmojiPickerOpen(true);
                    setCurrentEmojiPoint(point);
                }
                return; // Выходим, ожидая выбора эмодзи
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
    
    // Если ход сделан и включен контроль времени, активируем часы
    if (timeControlEnabled && !isClockActive && isEditMode) {
      setIsClockActive(true);
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

  useEffect(() => {
    // Обновляем активный инструмент рисования в зависимости от выбранного инструмента
    if (activeEditTool === EditTool.DRAW_LINE) {
      setIsDrawingMode(true);
      setCurrentDrawingType(DrawingMode.LINE);
    } else if (activeEditTool === EditTool.DRAW_ARROW) {
      setIsDrawingMode(true);
      setCurrentDrawingType(DrawingMode.ARROW);
    } else if (activeEditTool === EditTool.DRAW_FREEHAND) {
      setIsDrawingMode(true);
      setCurrentDrawingType(DrawingMode.FREEHAND);
    } else if (activeEditTool === EditTool.REMOVE_DRAWING) {
      setIsDrawingMode(true);
      setCurrentDrawingType(DrawingMode.ERASER);
    } else {
      setIsDrawingMode(false);
      setCurrentDrawingType(DrawingMode.NONE);
    }
  }, [activeEditTool]);

  // Функции для обработки событий рисования
  const handleDrawStart = (point: Point) => {
    setDrawingStartPoint(point);
    setDrawingEndPoint(point); // Изначально конечная точка такая же, как и начальная
    
    // Создаем временное рисование в зависимости от типа
    if (currentDrawingType === DrawingMode.LINE) {
      setTemporaryDrawing({
        start: point,
        end: point,
        color: currentDrawingColor, // Используем выбранный цвет
        thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
      } as DrawingLine);
    } else if (currentDrawingType === DrawingMode.ARROW) {
      setTemporaryDrawing({
        start: point,
        end: point,
        color: currentDrawingColor, // Используем выбранный цвет
        thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
      } as DrawingArrow);
    } else if (currentDrawingType === DrawingMode.FREEHAND) {
      setCurrentFreehandPath([point]);
    } else if (currentDrawingType === DrawingMode.ERASER) {
      // Проверяем, нужно ли удалить линию или стрелку
      let foundLine = currentLines.find(line => isPointNearLine(point, line));
      let foundArrow = !foundLine ? currentArrows.find(arrow => isPointNearLine(point, arrow)) : undefined;
      
      // Проверяем, нужно ли удалить путь свободного рисования
      let foundPath: DrawingPath | undefined = undefined;
      if (!foundLine && !foundArrow) {
        // Находим ближайший путь свободного рисования
        for (const path of currentPaths) {
          // Проверяем каждый сегмент пути
          for (let i = 0; i < path.points.length - 1; i++) {
            const lineSegment: DrawingLine = {
              start: path.points[i],
              end: path.points[i + 1],
              color: path.color,
              thickness: path.thickness
            };
            
            if (isPointNearLine(point, lineSegment)) {
              foundPath = path;
              break;
            }
          }
          
          if (foundPath) break;
        }
      }
      
      if (foundLine && onRemoveDrawing) {
        onRemoveDrawing(foundLine, undefined, undefined);
      } else if (foundArrow && onRemoveDrawing) {
        onRemoveDrawing(undefined, foundArrow, undefined);
      } else if (foundPath && onRemoveDrawing) {
        onRemoveDrawing(undefined, undefined, foundPath);
      }
    }
  };

  const handleDrawMove = (point: Point) => {
    if (!drawingStartPoint) return;
    
    setDrawingEndPoint(point);
    
    // Обновляем временное рисование
    if (temporaryDrawing && (currentDrawingType === DrawingMode.LINE || currentDrawingType === DrawingMode.ARROW)) {
      const updatedDrawing = {
        ...temporaryDrawing,
        end: point
      };
      setTemporaryDrawing(updatedDrawing);
    } else if (currentDrawingType === DrawingMode.FREEHAND) {
      // Для свободного рисования добавляем точку к пути
      if (currentFreehandPath.length === 0 || 
          currentFreehandPath[currentFreehandPath.length - 1].r !== point.r || 
          currentFreehandPath[currentFreehandPath.length - 1].c !== point.c) {
        setCurrentFreehandPath(prev => [...prev, point]);
      }
    } else if (currentDrawingType === DrawingMode.ERASER) {
      // При движении с зажатой кнопкой мыши проверяем удаление
      if (document.querySelectorAll('button:active').length > 0) {
        // Проверяем, нужно ли удалить линию или стрелку
        let foundLine = currentLines.find(line => isPointNearLine(point, line));
        let foundArrow = !foundLine ? currentArrows.find(arrow => isPointNearLine(point, arrow)) : undefined;
        
        // Проверяем, нужно ли удалить путь свободного рисования
        let foundPath: DrawingPath | undefined = undefined;
        if (!foundLine && !foundArrow) {
          // Находим ближайший путь свободного рисования
          for (const path of currentPaths) {
            // Проверяем каждый сегмент пути
            for (let i = 0; i < path.points.length - 1; i++) {
              const lineSegment: DrawingLine = {
                start: path.points[i],
                end: path.points[i + 1],
                color: path.color,
                thickness: path.thickness
              };
              
              if (isPointNearLine(point, lineSegment)) {
                foundPath = path;
                break;
              }
            }
            
            if (foundPath) break;
          }
        }
        
        if (foundLine && onRemoveDrawing) {
          onRemoveDrawing(foundLine, undefined, undefined);
        } else if (foundArrow && onRemoveDrawing) {
          onRemoveDrawing(undefined, foundArrow, undefined);
        } else if (foundPath && onRemoveDrawing) {
          onRemoveDrawing(undefined, undefined, foundPath);
        }
      }
    }
  };

  // Добавляем или обновляем функцию handleRemoveDrawing
  const handleRemoveDrawing = (line?: DrawingLine, arrow?: DrawingArrow, path?: DrawingPath) => {
    if (!gameData || !currentNodeId) return;

    // Если передана линия для удаления
    if (line) {
      // Удаляем линию из массива
      const updatedLines = currentLines.filter(
        l => !(l.start.r === line.start.r && l.start.c === line.start.c && 
               l.end.r === line.end.r && l.end.c === line.end.c)
      );
      setCurrentLines(updatedLines);

      // Удаляем соответствующее SGF свойство
      if (gameData && currentNodeId) {
        const updatedGameData = { ...gameData };
        const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
        const updatedSgfProps = { ...updatedNode.sgfProps };
        
        // Формируем SGF координаты для сравнения
        const sgfStartCoord = utilPointToSgfCoord(line.start);
        const sgfEndCoord = utilPointToSgfCoord(line.end);
        const lnValue = `${sgfStartCoord}:${sgfEndCoord}`;
        
        if (updatedSgfProps['LN']) {
          updatedSgfProps['LN'] = updatedSgfProps['LN'].filter(val => val !== lnValue);
          if (updatedSgfProps['LN'].length === 0) {
            delete updatedSgfProps['LN'];
          }
        }
        
        updatedNode.sgfProps = updatedSgfProps;
        updatedGameData.nodes[currentNodeId] = updatedNode;
        setGameData(updatedGameData);
      }
    }
    
    // Если передана стрелка для удаления
    else if (arrow) {
      // Удаляем стрелку из массива
      const updatedArrows = currentArrows.filter(
        a => !(a.start.r === arrow.start.r && a.start.c === arrow.start.c && 
               a.end.r === arrow.end.r && a.end.c === arrow.end.c)
      );
      setCurrentArrows(updatedArrows);

      // Удаляем соответствующее SGF свойство
      if (gameData && currentNodeId) {
        const updatedGameData = { ...gameData };
        const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
        const updatedSgfProps = { ...updatedNode.sgfProps };
        
        // Формируем SGF координаты для сравнения
        const sgfStartCoord = utilPointToSgfCoord(arrow.start);
        const sgfEndCoord = utilPointToSgfCoord(arrow.end);
        const arValue = `${sgfStartCoord}:${sgfEndCoord}`;
        
        if (updatedSgfProps['AR']) {
          updatedSgfProps['AR'] = updatedSgfProps['AR'].filter(val => val !== arValue);
          if (updatedSgfProps['AR'].length === 0) {
            delete updatedSgfProps['AR'];
          }
        }
        
        updatedNode.sgfProps = updatedSgfProps;
        updatedGameData.nodes[currentNodeId] = updatedNode;
        setGameData(updatedGameData);
      }
    }
    
    // Если передан путь для удаления
    else if (path) {
      // Находим путь в массиве текущих путей
      const pathIndex = currentPaths.findIndex(p => 
        // Простая проверка - если количество точек совпадает и первая/последняя точки совпадают
        p.points.length === path.points.length && 
        p.points[0].r === path.points[0].r && 
        p.points[0].c === path.points[0].c &&
        p.points[p.points.length - 1].r === path.points[path.points.length - 1].r && 
        p.points[p.points.length - 1].c === path.points[path.points.length - 1].c
      );
      
      if (pathIndex !== -1) {
        // Удаляем путь из массива
        const updatedPaths = [...currentPaths];
        updatedPaths.splice(pathIndex, 1);
        setCurrentPaths(updatedPaths);
        
        // Удаляем соответствующее SGF свойство
        if (gameData && currentNodeId) {
          const updatedGameData = { ...gameData };
          const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
          const updatedSgfProps = { ...updatedNode.sgfProps };
          
          // Создаем строковое представление пути для поиска в SGF
          // Для упрощения ищем просто по первым координатам
          if (updatedSgfProps['ZZ']) {
            const pathStart = utilPointToSgfCoord(path.points[0]) + utilPointToSgfCoord(path.points[1]);
            const pathIndex = updatedSgfProps['ZZ'].findIndex(zz => zz.startsWith(pathStart));
            
            if (pathIndex !== -1) {
              updatedSgfProps['ZZ'].splice(pathIndex, 1);
              if (updatedSgfProps['ZZ'].length === 0) {
                delete updatedSgfProps['ZZ'];
              }
            }
          }
          
          updatedNode.sgfProps = updatedSgfProps;
          updatedGameData.nodes[currentNodeId] = updatedNode;
          setGameData(updatedGameData);
        }
      }
    }
  };

  // Обработчик изменения цвета
  const handleColorChange = (color: string) => {
    setCurrentDrawingColor(color);
  };

  // Компонент выбора цвета в интерфейсе
  {isEditMode && (
    <>
      <EditToolbar 
        activeTool={activeEditTool} 
        onToolSelect={setActiveEditTool} 
      />
      {/* Панель выбора цвета */}
      {(activeEditTool === EditTool.DRAW_LINE || 
        activeEditTool === EditTool.DRAW_ARROW || 
        activeEditTool === EditTool.DRAW_FREEHAND) && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 mb-2 dark:border-gray-700">
            Цвет рисования
          </h3>
          <div className="flex flex-wrap gap-2">
            {["#FF4500", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#000000", "#FFFFFF"].map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className={`w-8 h-8 rounded-full border ${currentDrawingColor === color ? 'border-4 border-gray-500' : 'border border-gray-300'}`}
                style={{ backgroundColor: color }}
                aria-label={`Выбрать цвет ${color}`}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )}

  const handleDrawEnd = (point: Point) => {
    if (!drawingStartPoint) return;
    
    setDrawingEndPoint(point);
    
    // Если начальная и конечная точки совпадают при рисовании линии или стрелки, не добавляем
    if ((currentDrawingType === DrawingMode.LINE || currentDrawingType === DrawingMode.ARROW) && 
        drawingStartPoint.r === point.r && drawingStartPoint.c === point.c) {
      setDrawingStartPoint(null);
      setDrawingEndPoint(null);
      setTemporaryDrawing(null);
      return;
    }
    
    // Добавляем рисование в соответствующий массив
    if (currentDrawingType === DrawingMode.LINE) {
      const newLine: DrawingLine = {
        start: drawingStartPoint,
        end: point,
        color: currentDrawingColor, // Используем выбранный цвет
        thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
      };
      setCurrentLines([...currentLines, newLine]);
      
      // Сохраняем линию в SGF метаданных текущего узла
      if (gameData && currentNodeId) {
        const updatedGameData = { ...gameData };
        const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
        const updatedSgfProps = { ...updatedNode.sgfProps };
        
        // SGF LN[point1:point2] формат для линий
        const sgfStartCoord = utilPointToSgfCoord(drawingStartPoint);
        const sgfEndCoord = utilPointToSgfCoord(point);
        const lnValue = `${sgfStartCoord}:${sgfEndCoord}`;
        
        if (!updatedSgfProps['LN']) updatedSgfProps['LN'] = [];
        updatedSgfProps['LN'].push(lnValue);
        
        // Сохраняем цвет в кастомном свойстве, если он отличается от стандартного
        if (currentDrawingColor !== "#FF4500") {
          if (!updatedSgfProps['CL']) updatedSgfProps['CL'] = [];
          updatedSgfProps['CL'].push(`${lnValue}:${currentDrawingColor}`);
        }
        
        updatedNode.sgfProps = updatedSgfProps;
        updatedGameData.nodes[currentNodeId] = updatedNode;
        setGameData(updatedGameData);
      }
    } else if (currentDrawingType === DrawingMode.ARROW) {
      const newArrow: DrawingArrow = {
        start: drawingStartPoint,
        end: point,
        color: currentDrawingColor, // Используем выбранный цвет
        thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
      };
      setCurrentArrows([...currentArrows, newArrow]);
      
      // Сохраняем стрелку в SGF метаданных текущего узла
      if (gameData && currentNodeId) {
        const updatedGameData = { ...gameData };
        const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
        const updatedSgfProps = { ...updatedNode.sgfProps };
        
        // SGF AR[point1:point2] формат для стрелок
        const sgfStartCoord = utilPointToSgfCoord(drawingStartPoint);
        const sgfEndCoord = utilPointToSgfCoord(point);
        const arValue = `${sgfStartCoord}:${sgfEndCoord}`;
        
        if (!updatedSgfProps['AR']) updatedSgfProps['AR'] = [];
        updatedSgfProps['AR'].push(arValue);
        
        // Сохраняем цвет в кастомном свойстве, если он отличается от стандартного
        if (currentDrawingColor !== "#FF4500") {
          if (!updatedSgfProps['CA']) updatedSgfProps['CA'] = [];
          updatedSgfProps['CA'].push(`${arValue}:${currentDrawingColor}`);
        }
        
        updatedNode.sgfProps = updatedSgfProps;
        updatedGameData.nodes[currentNodeId] = updatedNode;
        setGameData(updatedGameData);
      }
    } else if (currentDrawingType === DrawingMode.FREEHAND && currentFreehandPath.length > 1) {
      // Добавляем путь для свободного рисования
      const newPath: DrawingPath = {
        points: [...currentFreehandPath, point],
        color: currentDrawingColor, // Используем выбранный цвет
        thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
      };
      setCurrentPaths([...currentPaths, newPath]);
      
      // Сохраняем путь в SGF метаданных текущего узла (используем кастомное свойство ZZ)
      if (gameData && currentNodeId) {
        const updatedGameData = { ...gameData };
        const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
        const updatedSgfProps = { ...updatedNode.sgfProps };
        
        // Создаем строковое представление пути
        let pathCoords = "";
        for (const pathPoint of [...currentFreehandPath, point]) {
          const sgfCoord = utilPointToSgfCoord(pathPoint);
          pathCoords += sgfCoord;
        }
        
        if (!updatedSgfProps['ZZ']) updatedSgfProps['ZZ'] = [];
        updatedSgfProps['ZZ'].push(pathCoords);
        
        // Сохраняем цвет в кастомном свойстве, если он отличается от стандартного
        if (currentDrawingColor !== "#FF4500") {
          if (!updatedSgfProps['ZC']) updatedSgfProps['ZC'] = [];
          updatedSgfProps['ZC'].push(`${pathCoords.substring(0, 4)}:${currentDrawingColor}`);
        }
        
        updatedNode.sgfProps = updatedSgfProps;
        updatedGameData.nodes[currentNodeId] = updatedNode;
        setGameData(updatedGameData);
      }
    }
    
    // Сбрасываем состояние рисования
    setDrawingStartPoint(null);
    setDrawingEndPoint(null);
    setTemporaryDrawing(null);
    setCurrentFreehandPath([]);
  };

  // Добавляем функцию для обработки выбора эмодзи
  const handleEmojiSelect = (emoji: string) => {
      setIsEmojiPickerOpen(false);
      
      if (!currentEmojiPoint || !gameData || !currentNodeId) return;
      
      const currentSgfNode = gameData.nodes[currentNodeId];
      if (!currentSgfNode) return;
      
      const point = currentEmojiPoint;
      const sgfCoord = utilPointToSgfCoord(point);
      const newSgfProps = { ...(currentSgfNode.sgfProps || {}) };
      
      // Обрабатываем выбор эмодзи
      let lbList = newSgfProps['LB'] ? [...newSgfProps['LB']] : [];
      const coordPrefix = sgfCoord + ':';
      lbList = lbList.filter(item => !item.startsWith(coordPrefix)); // Remove existing label
      
      if (emoji !== "") {
          lbList.push(`${sgfCoord}:${emoji}`);
          
          // Добавляем кастомное свойство для отметки эмодзи
          if (!newSgfProps['EM']) newSgfProps['EM'] = [];
          if (!newSgfProps['EM'].includes(sgfCoord)) {
              newSgfProps['EM'].push(sgfCoord);
          }
      }
      
      if (lbList.length > 0) newSgfProps['LB'] = lbList;
      else delete newSgfProps['LB'];
      
      const updatedNode = { ...currentSgfNode, sgfProps: newSgfProps };
      const updatedNodes = { ...gameData.nodes, [currentNodeId]: updatedNode };
      const newFullGameData = {...gameData, nodes: updatedNodes};
      setGameData(newFullGameData);
      updateStateFromNodeId(currentNodeId, newFullGameData);
      
      setCurrentEmojiPoint(null);
  };

  const handleTouchStart = (event: React.TouchEvent, point: Point) => {
    if (isDrawingMode) {
      event.preventDefault();
      setDrawingStartPoint(point);
      setDrawingEndPoint(point);
      
      if (currentDrawingType === DrawingMode.LINE) {
        setTemporaryDrawing({
          start: point,
          end: point,
          color: currentDrawingColor,
          thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
        } as DrawingLine);
      } else if (currentDrawingType === DrawingMode.ARROW) {
        setTemporaryDrawing({
          start: point,
          end: point,
          color: currentDrawingColor,
          thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
        } as DrawingArrow);
      } else if (currentDrawingType === DrawingMode.FREEHAND) {
        setCurrentFreehandPath([point]);
      }
    }
  };

  const handleTouchMove = (event: React.TouchEvent, point: Point) => {
    if (isDrawingMode && drawingStartPoint) {
      event.preventDefault();
      setDrawingEndPoint(point);
      
      if (temporaryDrawing && (currentDrawingType === DrawingMode.LINE || currentDrawingType === DrawingMode.ARROW)) {
        setTemporaryDrawing({
          ...temporaryDrawing,
          end: point
        });
      } else if (currentDrawingType === DrawingMode.FREEHAND) {
        setCurrentFreehandPath(prev => [...prev, point]);
      }
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (isDrawingMode && drawingStartPoint && drawingEndPoint) {
      // Similar to handleDrawEnd but for touch events
      if (drawingStartPoint.r === drawingEndPoint.r && drawingStartPoint.c === drawingEndPoint.c &&
          (currentDrawingType === DrawingMode.LINE || currentDrawingType === DrawingMode.ARROW)) {
        // Точки совпадают, не создаем линию/стрелку
        setDrawingStartPoint(null);
        setDrawingEndPoint(null);
        setTemporaryDrawing(null);
        return;
      }
      
      if (currentDrawingType === DrawingMode.LINE) {
        const newLine: DrawingLine = {
          start: drawingStartPoint,
          end: drawingEndPoint,
          color: currentDrawingColor,
          thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
        };
        setCurrentLines([...currentLines, newLine]);
        
        // Сохраняем в SGF (аналогично handleDrawEnd)
        if (gameData && currentNodeId) {
          const updatedGameData = { ...gameData };
          const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
          const updatedSgfProps = { ...updatedNode.sgfProps };
          
          const sgfStartCoord = utilPointToSgfCoord(drawingStartPoint);
          const sgfEndCoord = utilPointToSgfCoord(drawingEndPoint);
          const lnValue = `${sgfStartCoord}:${sgfEndCoord}`;
          
          if (!updatedSgfProps['LN']) updatedSgfProps['LN'] = [];
          updatedSgfProps['LN'].push(lnValue);
          
          if (currentDrawingColor !== "#FF4500") {
            if (!updatedSgfProps['CL']) updatedSgfProps['CL'] = [];
            updatedSgfProps['CL'].push(`${lnValue}:${currentDrawingColor}`);
          }
          
          updatedNode.sgfProps = updatedSgfProps;
          updatedGameData.nodes[currentNodeId] = updatedNode;
          setGameData(updatedGameData);
        }
      } else if (currentDrawingType === DrawingMode.ARROW) {
        // Аналогично для стрелок
        const newArrow: DrawingArrow = {
          start: drawingStartPoint,
          end: drawingEndPoint,
          color: currentDrawingColor,
          thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
        };
        setCurrentArrows([...currentArrows, newArrow]);
        
        if (gameData && currentNodeId) {
          const updatedGameData = { ...gameData };
          const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
          const updatedSgfProps = { ...updatedNode.sgfProps };
          
          const sgfStartCoord = utilPointToSgfCoord(drawingStartPoint);
          const sgfEndCoord = utilPointToSgfCoord(drawingEndPoint);
          const arValue = `${sgfStartCoord}:${sgfEndCoord}`;
          
          if (!updatedSgfProps['AR']) updatedSgfProps['AR'] = [];
          updatedSgfProps['AR'].push(arValue);
          
          if (currentDrawingColor !== "#FF4500") {
            if (!updatedSgfProps['CA']) updatedSgfProps['CA'] = [];
            updatedSgfProps['CA'].push(`${arValue}:${currentDrawingColor}`);
          }
          
          updatedNode.sgfProps = updatedSgfProps;
          updatedGameData.nodes[currentNodeId] = updatedNode;
          setGameData(updatedGameData);
        }
      } else if (currentDrawingType === DrawingMode.FREEHAND && currentFreehandPath.length > 1) {
        // Добавляем path для freehand рисования
        const newPath: DrawingPath = {
          points: [...currentFreehandPath],
          color: currentDrawingColor,
          thickness: Math.max(2, getCellSize(boardSize, isMobile) / 12)
        };
        setCurrentPaths([...currentPaths, newPath]);
        
        if (gameData && currentNodeId) {
          const updatedGameData = { ...gameData };
          const updatedNode = { ...updatedGameData.nodes[currentNodeId] };
          const updatedSgfProps = { ...updatedNode.sgfProps };
          
          let pathCoords = "";
          for (const pathPoint of currentFreehandPath) {
            const sgfCoord = utilPointToSgfCoord(pathPoint);
            pathCoords += sgfCoord;
          }
          
          if (!updatedSgfProps['ZZ']) updatedSgfProps['ZZ'] = [];
          updatedSgfProps['ZZ'].push(pathCoords);
          
          if (currentDrawingColor !== "#FF4500") {
            if (!updatedSgfProps['ZC']) updatedSgfProps['ZC'] = [];
            updatedSgfProps['ZC'].push(`${pathCoords.substring(0, 4)}:${currentDrawingColor}`);
          }
          
          updatedNode.sgfProps = updatedSgfProps;
          updatedGameData.nodes[currentNodeId] = updatedNode;
          setGameData(updatedGameData);
        }
      }
      
      // Очищаем состояние рисования
      setDrawingStartPoint(null);
      setDrawingEndPoint(null);
      setTemporaryDrawing(null);
      setCurrentFreehandPath([]);
    }
  };

  // Обеспечиваем доске правильный размер на мобильных устройствах
  useEffect(() => {
    if (boardContainerRef.current) {
      const resizeBoard = () => {
        if (isMobile) {
          // Для мобильных - используем максимально доступное пространство
          const viewportWidth = window.innerWidth;
          // Получаем размер экрана с учетом небольших отступов
          const availableWidth = viewportWidth - 20;
          // Размер ячейки исходя из размера доски и доступной ширины
          // Оставляем немного места для сетки и границ
          const calculatedSize = Math.floor((availableWidth - 10) / boardSize);

          setMobileCellSize(calculatedSize);
        } else {
          // Для десктопа используем фиксированные размеры
          setMobileCellSize(null);
        }
      };
      
      resizeBoard();
      window.addEventListener('resize', resizeBoard);
      
      return () => {
        window.removeEventListener('resize', resizeBoard);
      };
    }
  }, [isMobile, boardSize]);

  // Измененный метод получения размера ячейки с учетом мобильного состояния
  const getCurrentCellSize = useCallback(() => {
    // Если есть мобильный размер, используем его, иначе используем стандартный размер
    return mobileCellSize || getCellSize(boardSize, isMobile);
  }, [boardSize, isMobile, mobileCellSize]);

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

  // Обработчик истечения времени
  const handleTimeExpired = () => {
    setIsClockActive(false);
    alert("Время вышло!");
  };
  
  // Переключение активного игрока для часов
  const switchActivePlayer = () => {
    if (timeControlEnabled) {
      // Если ходит другой игрок, переключаем активного игрока
      setEditModePlayer(editModePlayer === StoneColor.Black ? StoneColor.White : StoneColor.Black);
    }
  };
  
  // Обработчик для пропуска хода
  const handlePass = () => {
    if (isEditMode && timeControlEnabled) {
      switchActivePlayer();
    }
  };
  
  // Обработчик для паузы/запуска часов
  const handlePauseResumeClock = () => {
    if (timeControlEnabled) {
      setIsClockActive(!isClockActive);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 py-2 px-1 sm:py-4 sm:px-2 lg:px-6 text-gray-800 dark:text-gray-200">
      {/* Модальное окно создания игры */}
      <CreateGameModal 
        isOpen={isCreateGameModalOpen}
        onClose={() => setIsCreateGameModalOpen(false)}
        onCreateGame={handleCreateGame}
      />
      
      <header className={`text-center ${isMobile ? 'mb-2' : 'mb-3 sm:mb-6'}`}>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-gray-100">Go Board SGF Viewer</h1>
      </header>

      {/* На мобильных используем flex-col, на десктопе - сетку с тремя колонками */}
      <div className={`max-w-full mx-auto ${isMobile ? 'flex flex-col space-y-2' : 'grid grid-cols-1 lg:grid-cols-[minmax(250px,auto)_1fr_minmax(250px,auto)] gap-4'}`}>
        
        {/* Элементы управления - слева на десктопе, сверху на мобильных */}
        <div className={`${isMobile ? 'order-1 px-1' : 'space-y-4 order-1'}`}>
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
            isMobile={isMobile}
            onCreateGameClick={() => setIsCreateGameModalOpen(true)}
          />
          
          {isEditMode && (
            <GameControls 
              isEditMode={isEditMode}
              timeControlEnabled={timeControlEnabled}
              isClockActive={isClockActive}
              currentPlayer={editModePlayer}
              onPass={handlePass}
              onPauseResumeClock={handlePauseResumeClock}
            />
          )}
          
          {/* Часы - показываем, только если включен контроль времени */}
          {timeControlEnabled && (
            <TimeClock 
              isActive={isClockActive}
              playerTurn={editModePlayer}
              initialMainTime={mainTimeInSeconds}
              byoyomi={byoyomiInSeconds}
              periods={byoyomiPeriods}
              onTimeExpired={handleTimeExpired}
            />
          )}
          
          {isEditMode && (
            <div className={`${isMobile ? 'mt-2' : ''}`}>
              <EditToolbar 
                activeTool={activeEditTool} 
                onToolSelect={setActiveEditTool}
                isMobile={isMobile}
              />
              {/* На мобильных оставляем только основные элементы управления цветом */}
              {!isMobile && (activeEditTool === EditTool.DRAW_LINE || 
                activeEditTool === EditTool.DRAW_ARROW || 
                activeEditTool === EditTool.DRAW_FREEHAND) && (
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-3 mt-3">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 mb-2 dark:border-gray-700">
                    Цвет рисования
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["#FF4500", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#000000", "#FFFFFF"].map(color => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(color)}
                        className={`w-8 h-8 rounded-full border ${currentDrawingColor === color ? 'border-4 border-gray-500' : 'border border-gray-300'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Выбрать цвет ${color}`}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Основная информация о партии */}
          {!isMobile && (
            <div>
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
                isMobile={isMobile}
              />
            </div>
          )}
          
          {/* Комментарии для десктопа */}
          {!isEditMode && currentSgfNodeForInfo && !isMobile && <CommentsDisplay comment={currentSgfNodeForInfo.comment} />}
        </div>

        {/* Доска - ВСЕГДА в центре, как на мобильных, так и на десктопе */}
        <div className={`flex flex-col items-center justify-start ${isMobile ? 'order-2 w-full' : 'order-2'}`}>
          <div 
            ref={boardContainerRef}
            className={`bg-white dark:bg-gray-800 ${isMobile ? 'p-0.5 sm:p-1' : 'p-1 sm:p-2 md:p-4'} rounded-lg shadow-xl ${isMobile ? 'w-full' : 'inline-block'} overflow-auto max-w-full`}
          >
            <GoBoard
              boardSize={boardSize}
              boardState={boardState}
              lastMove={lastPlayedMoveCoord}
              koPoint={currentFullKoState.koPoint} 
              onIntersectionClick={handleBoardClick}
              cellSize={getCurrentCellSize()}
              triangles={currentTriangles}
              squares={currentSquares}
              circles={currentCircles}
              marks={currentMarks}
              labels={currentLabels}
              lines={temporaryDrawing && currentDrawingType === DrawingMode.LINE 
                ? [...currentLines, temporaryDrawing as DrawingLine] 
                : currentLines}
              arrows={temporaryDrawing && currentDrawingType === DrawingMode.ARROW 
                ? [...currentArrows, temporaryDrawing as DrawingArrow] 
                : currentArrows}
              paths={currentPaths}
              isDrawingMode={isDrawingMode}
              drawingMode={currentDrawingType}
              onDrawStart={handleDrawStart}
              onDrawMove={handleDrawMove}
              onDrawEnd={handleDrawEnd}
              onRemoveDrawing={handleRemoveDrawing}
              isMobile={isMobile}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          </div>
           
          {/* Компактная панель выбора цвета под доской */}
          {isEditMode && (activeEditTool === EditTool.DRAW_LINE || 
            activeEditTool === EditTool.DRAW_ARROW || 
            activeEditTool === EditTool.DRAW_FREEHAND || 
            activeEditTool === EditTool.REMOVE_DRAWING) && (
            <div className={`mt-2 sm:mt-4 bg-white dark:bg-gray-800 p-2 sm:p-3 rounded-lg shadow-md ${isMobile ? 'w-full' : 'w-full'} ${isMobile ? 'text-sm' : ''}`}>
              {/* Отображаем компактную информацию о текущем инструменте */}
              <div className={`${isMobile ? 'mb-1' : 'mb-2'} text-center`}>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {toolDisplayInfo[activeEditTool]?.label || 'Рисование'} 
                  {!isMobile && (
                    <>
                      {activeEditTool === EditTool.DRAW_LINE && " - протяните линию между точками"}
                      {activeEditTool === EditTool.DRAW_ARROW && " - протяните стрелку между точками"}
                      {activeEditTool === EditTool.DRAW_FREEHAND && " - рисуйте свободно"}
                      {activeEditTool === EditTool.REMOVE_DRAWING && " - кликните по рисунку для удаления"}
                    </>
                  )}
                </span>
                {!isMobile && activeEditTool !== EditTool.REMOVE_DRAWING && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    (клавиша {
                      activeEditTool === EditTool.DRAW_LINE ? 'L' : 
                      activeEditTool === EditTool.DRAW_ARROW ? 'A' : 
                      activeEditTool === EditTool.DRAW_FREEHAND ? 'F' : ''
                    })
                  </span>
                )}
              </div>
              
              {/* Компактная палитра цветов */}
              {activeEditTool !== EditTool.REMOVE_DRAWING && (
                <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
                  {isMobile ? null : <span className="text-sm text-gray-600 dark:text-gray-400 mr-2 self-center">Цвет:</span>}
                  {/* Основные цвета */}
                  {["#FF4500", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"].map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`${isMobile ? 'w-8 h-8' : 'w-8 h-8'} rounded-full border-2 ${currentDrawingColor === color ? 'border-4 border-gray-500 scale-110' : 'border border-gray-300'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Выбрать цвет ${color}`}
                      title={color}
                    />
                  ))}
                  {/* На мобильных показываем меньше цветов */}
                  {!isMobile && ["#FFA500", "#800080", "#008000", "#000080", "#A52A2A", "#000000", "#FFFFFF"].map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`w-8 h-8 rounded-full border-2 ${currentDrawingColor === color ? 'border-4 border-gray-500 scale-110' : 'border border-gray-300'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Выбрать цвет ${color}`}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {isMobile && (
            <div className="mt-2 w-full">
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
                isMobile={isMobile}
              />
            </div>
          )}
          
          {isEditMode && activeEditTool && toolDisplayInfo[activeEditTool] && !["DRAW_LINE", "DRAW_ARROW", "DRAW_FREEHAND", "REMOVE_DRAWING"].includes(activeEditTool) &&
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Активный инструмент: {toolDisplayInfo[activeEditTool]?.label || 'Select'}. 
              {activeEditTool === EditTool.REMOVE_DRAWING ? " Кликните по линии, стрелке или рисунку, чтобы удалить." : ""}
            </p>
          }
          {!isEditMode && gameData?.info.name === "New Game" &&
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Click on the board to play a move.</p>
          }
        </div>
        
        {/* Дерево ходов - справа на десктопе, внизу на мобильных */}
        <div className={`${isMobile ? 'order-3 mt-3' : 'order-3'}`}>
          {gameData && gameData.rootNodeId && (
            <MoveTreeDisplay 
              nodes={gameData.nodes}
              rootId={gameData.rootNodeId}
              activeNodeId={currentNodeId}
              onNodeSelect={nodeId => navigateToNode(nodeId)} 
              isEditMode={isEditMode}
              boardSize={gameData.info.boardSize} 
              activePath={activePath}
              isMobile={isMobile}
            />
          )}
        </div>

        {/* На мобильных устройствах показываем комментарии в конце */}
        {!isEditMode && currentSgfNodeForInfo && isMobile && (
          <div className="order-4 mt-3 px-1">
            <CommentsDisplay comment={currentSgfNodeForInfo.comment} />
          </div>
        )}
      </div>
      
      <footer className={`text-center ${isMobile ? 'mt-6 py-2' : 'mt-12 py-4'} text-gray-600 dark:text-gray-300 text-sm`}>
        Go Board SGF Viewer - Advanced Baduk/Weiqi Experience
      </footer>
      
      {/* Добавляем EmojiPicker */}
      <EmojiPicker
        isOpen={isEmojiPickerOpen}
        position={emojiPickerPosition}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={handleEmojiSelect}
        isMobile={isMobile}
      />

      {/* Плавающие кнопки навигации для мобильных */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 flex flex-col gap-2">
          <button 
            onClick={() => handleNavigation('prev')}
            className="w-12 h-12 bg-gray-800 dark:bg-gray-600 text-white p-2 rounded-full shadow-lg text-xl flex items-center justify-center"
            aria-label="Предыдущий ход"
          >
            ←
          </button>
          <button 
            onClick={() => handleNavigation('next')}
            className="w-12 h-12 bg-gray-800 dark:bg-gray-600 text-white p-2 rounded-full shadow-lg text-xl flex items-center justify-center" 
            aria-label="Следующий ход"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
