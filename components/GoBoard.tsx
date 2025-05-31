import React, { useState } from 'react';
import { StoneColor, Point, LabelInfo, DrawingLine, DrawingArrow, DrawingPath, DrawingMode } from '../types';

interface GoBoardProps {
  boardSize: number;
  boardState: StoneColor[][];
  lastMove?: Point | null;
  koPoint?: Point | null;
  onIntersectionClick?: (p: Point) => void;
  cellSize?: number;
  // SGF Markup props
  triangles?: Point[];
  squares?: Point[];
  circles?: Point[];
  marks?: Point[]; // X-marks from MA
  labels?: LabelInfo[];
  // Свойства для рисования
  lines?: DrawingLine[];
  arrows?: DrawingArrow[];
  paths?: DrawingPath[]; // Для свободного рисования
  // Для режима рисования
  isDrawingMode?: boolean;
  drawingMode?: DrawingMode;
  onDrawStart?: (p: Point) => void;
  onDrawMove?: (p: Point) => void;
  onDrawEnd?: (p: Point) => void;
  onRemoveDrawing?: (line?: DrawingLine, arrow?: DrawingArrow, path?: DrawingPath) => void;
}

const GoBoard: React.FC<GoBoardProps> = ({
  boardSize,
  boardState,
  lastMove,
  koPoint,
  onIntersectionClick,
  cellSize = 30,
  triangles = [],
  squares = [],
  circles = [],
  marks = [],
  labels = [],
  // Свойства для рисования
  lines = [],
  arrows = [],
  paths = [],
  isDrawingMode = false,
  drawingMode = DrawingMode.NONE,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onRemoveDrawing,
}) => {
  const [currentDrawPath, setCurrentDrawPath] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  if (boardSize < 2) return <div className="text-red-500">Invalid board size.</div>;

  const padding = cellSize / 2;
  const svgSize = (boardSize - 1) * cellSize + 2 * padding;

  const getStarPoints = (size: number): Point[] => {
    if (size === 19) {
      return [
        { r: 3, c: 3 }, { r: 3, c: 9 }, { r: 3, c: 15 },
        { r: 9, c: 3 }, { r: 9, c: 9 }, { r: 9, c: 15 },
        { r: 15, c: 3 }, { r: 15, c: 9 }, { r: 15, c: 15 },
      ];
    }
    if (size === 13) {
      return [
        { r: 3, c: 3 }, { r: 3, c: 9 }, { r: 6, c: 6 },
        { r: 9, c: 3 }, { r: 9, c: 9 },
      ];
    }
    if (size === 9) {
      return [{ r: 2, c: 2 }, { r: 2, c: 6 }, { r: 4, c: 4 }, { r: 6, c: 2 }, { r: 6, c: 6 }];
    }
    return [];
  };

  const starPoints = getStarPoints(boardSize);
  const stoneRadius = cellSize / 2 - cellSize * 0.05;

  const renderMarkupSymbol = (
    point: Point,
    type: 'triangle' | 'square' | 'circle' | 'mark',
    index: number
  ) => {
    const cx = padding + point.c * cellSize;
    const cy = padding + point.r * cellSize;
    const size = stoneRadius * 1.1; // Увеличенный размер для маркеров
    const strokeColor = "#0047AB"; // Кобальтовый синий для лучшей видимости
    const strokeWidth = Math.max(2, cellSize / 10); // Дополнительно увеличенная толщина линий

    // Добавляем невидимую кликабельную область для всех типов маркеров
    const invisibleClickArea = onIntersectionClick && (
      <circle
        key={`click-${type}-${index}`}
        cx={cx}
        cy={cy}
        r={cellSize / 3}
        fill="transparent"
        className="cursor-pointer"
        onClick={() => onIntersectionClick(point)}
        style={{ pointerEvents: boardState[point.r][point.c] !== StoneColor.Empty ? 'none' : 'auto' }}
      />
    );

    switch (type) {
      case 'triangle':
        return (
          <React.Fragment key={`triangle-wrapper-${index}`}>
            {invisibleClickArea}
            <polygon
              key={`triangle-${index}`}
              points={`${cx},${cy - size} ${cx - size * 0.866},${cy + size * 0.5} ${cx + size * 0.866},${cy + size * 0.5}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))"
              className="pointer-events-none"
            />
          </React.Fragment>
        );
      case 'square':
        return (
          <React.Fragment key={`square-wrapper-${index}`}>
            {invisibleClickArea}
            <rect
              key={`square-${index}`}
              x={cx - size / 1.2}
              y={cy - size / 1.2}
              width={size * 1.6}
              height={size * 1.6}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))"
              className="pointer-events-none"
            />
          </React.Fragment>
        );
      case 'circle':
        return (
          <React.Fragment key={`circle-wrapper-${index}`}>
            {invisibleClickArea}
            <circle
              key={`circle-${index}`}
              cx={cx}
              cy={cy}
              r={size * 0.9}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))"
              className="pointer-events-none"
            />
          </React.Fragment>
        );
      case 'mark': // X-Mark
        const d = size * 0.8;
        return (
          <React.Fragment key={`mark-wrapper-${index}`}>
            {invisibleClickArea}
            <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke={strokeColor} strokeWidth={strokeWidth} filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))" className="pointer-events-none" />
            <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d} stroke={strokeColor} strokeWidth={strokeWidth} filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))" className="pointer-events-none" />
          </React.Fragment>
        );
      default:
        return null;
    }
  };

  // Функция для отрисовки линий
  const renderLine = (line: DrawingLine, index: number) => {
    const startX = padding + line.start.c * cellSize;
    const startY = padding + line.start.r * cellSize;
    const endX = padding + line.end.c * cellSize;
    const endY = padding + line.end.r * cellSize;

    return (
      <line
        key={`line-${index}`}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={line.color || "#FF4500"} // Оранжево-красный цвет по умолчанию
        strokeWidth={line.thickness || Math.max(2, cellSize / 12)}
        strokeLinecap="round"
        className="pointer-events-none"
        filter="drop-shadow(0 0 2px rgba(0,0,0,0.3))"
      />
    );
  };

  // Функция для отрисовки стрелок
  const renderArrow = (arrow: DrawingArrow, index: number) => {
    const startX = padding + arrow.start.c * cellSize;
    const startY = padding + arrow.start.r * cellSize;
    const endX = padding + arrow.end.c * cellSize;
    const endY = padding + arrow.end.r * cellSize;

    const arrowLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    if (arrowLength < cellSize / 2) return null; // Слишком короткая стрелка

    // Расчет угла для наконечника стрелки
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowHeadSize = Math.min(cellSize / 2, arrowLength / 4);

    // Координаты для наконечника стрелки
    const arrowTip1X = endX - arrowHeadSize * Math.cos(angle - Math.PI / 6);
    const arrowTip1Y = endY - arrowHeadSize * Math.sin(angle - Math.PI / 6);
    const arrowTip2X = endX - arrowHeadSize * Math.cos(angle + Math.PI / 6);
    const arrowTip2Y = endY - arrowHeadSize * Math.sin(angle + Math.PI / 6);

    // Укорачиваем линию стрелки, чтобы она не заходила под наконечник
    const shortenFactor = arrowHeadSize / 2;
    const shortenedEndX = endX - shortenFactor * Math.cos(angle);
    const shortenedEndY = endY - shortenFactor * Math.sin(angle);

    return (
      <g key={`arrow-${index}`} className="pointer-events-none">
        <line
          x1={startX}
          y1={startY}
          x2={shortenedEndX}
          y2={shortenedEndY}
          stroke={arrow.color || "#FF4500"} // Оранжево-красный цвет по умолчанию
          strokeWidth={arrow.thickness || Math.max(2, cellSize / 12)}
          strokeLinecap="round"
          filter="drop-shadow(0 0 2px rgba(0,0,0,0.3))"
        />
        <polygon
          points={`${endX},${endY} ${arrowTip1X},${arrowTip1Y} ${arrowTip2X},${arrowTip2Y}`}
          fill={arrow.color || "#FF4500"}
          filter="drop-shadow(0 0 2px rgba(0,0,0,0.3))"
        />
      </g>
    );
  };

  // Функция для отрисовки пути свободного рисования
  const renderPath = (path: DrawingPath, index: number) => {
    if (path.points.length < 2) return null;
    
    // Строим строку с путем для SVG path
    let pathData = `M ${padding + path.points[0].c * cellSize} ${padding + path.points[0].r * cellSize}`;
    
    for (let i = 1; i < path.points.length; i++) {
      pathData += ` L ${padding + path.points[i].c * cellSize} ${padding + path.points[i].r * cellSize}`;
    }
    
    return (
      <path
        key={`path-${index}`}
        d={pathData}
        fill="none"
        stroke={path.color || "#FF4500"} // Оранжево-красный цвет по умолчанию
        strokeWidth={path.thickness || Math.max(2, cellSize / 12)}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
        filter="drop-shadow(0 0 2px rgba(0,0,0,0.3))"
      />
    );
  };

  // Рендерим текущий путь рисования
  const renderCurrentPath = () => {
    if (currentDrawPath.length < 2) return null;
    
    let pathData = `M ${padding + currentDrawPath[0].c * cellSize} ${padding + currentDrawPath[0].r * cellSize}`;
    
    for (let i = 1; i < currentDrawPath.length; i++) {
      pathData += ` L ${padding + currentDrawPath[i].c * cellSize} ${padding + currentDrawPath[i].r * cellSize}`;
    }
    
    return (
      <path
        d={pathData}
        fill="none"
        stroke="#FF4500" // Оранжево-красный цвет
        strokeWidth={Math.max(2, cellSize / 12)}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
        filter="drop-shadow(0 0 2px rgba(0,0,0,0.3))"
      />
    );
  };

  // Проверка близости точки к линии или стрелке для удаления
  const isPointNearLine = (point: Point, line: DrawingLine): boolean => {
    const lineStartX = padding + line.start.c * cellSize;
    const lineStartY = padding + line.start.r * cellSize;
    const lineEndX = padding + line.end.c * cellSize;
    const lineEndY = padding + line.end.r * cellSize;
    
    const pointX = padding + point.c * cellSize;
    const pointY = padding + point.r * cellSize;
    
    // Расстояние от точки до линии
    const lineLength = Math.sqrt(Math.pow(lineEndX - lineStartX, 2) + Math.pow(lineEndY - lineStartY, 2));
    if (lineLength === 0) return false;
    
    const distance = Math.abs(
      (lineEndY - lineStartY) * pointX - 
      (lineEndX - lineStartX) * pointY + 
      lineEndX * lineStartY - 
      lineEndY * lineStartX
    ) / lineLength;
    
    // Проверяем, что точка находится в пределах отрезка линии
    const dotProduct = 
      ((pointX - lineStartX) * (lineEndX - lineStartX) + 
       (pointY - lineStartY) * (lineEndY - lineStartY)) / Math.pow(lineLength, 2);
    
    return distance <= cellSize / 3 && dotProduct >= 0 && dotProduct <= 1;
  };

  // Проверка близости точки к пути для удаления
  const isPointNearPath = (point: Point, path: DrawingPath): boolean => {
    // Проверяем расстояние до каждого сегмента пути
    for (let i = 0; i < path.points.length - 1; i++) {
      const segment: DrawingLine = {
        start: path.points[i],
        end: path.points[i + 1],
        color: path.color,
        thickness: path.thickness
      };
      
      if (isPointNearLine(point, segment)) {
        return true;
      }
    }
    return false;
  };

  // Функции для обработки режима свободного рисования
  const handleMouseDown = (e: React.MouseEvent, point: Point) => {
    if (!isDrawingMode) return;
    
    if (drawingMode === DrawingMode.ERASER) {
      // Проверяем, нужно ли удалить линию или стрелку
      let foundLine = lines.find(line => isPointNearLine(point, line));
      let foundArrow = !foundLine ? arrows.find(arrow => isPointNearLine(point, arrow)) : undefined;
      // Проверяем пути для свободного рисования
      let foundPath = !foundLine && !foundArrow ? paths.find(path => isPointNearPath(point, path)) : undefined;
      
      if (foundLine && onRemoveDrawing) {
        onRemoveDrawing(foundLine, undefined, undefined);
      } else if (foundArrow && onRemoveDrawing) {
        onRemoveDrawing(undefined, foundArrow, undefined);
      } else if (foundPath && onRemoveDrawing) {
        onRemoveDrawing(undefined, undefined, foundPath);
      }
      return;
    }
    
    if (onDrawStart) {
      e.preventDefault();
      onDrawStart(point);
      
      if (drawingMode === DrawingMode.FREEHAND) {
        setIsDrawing(true);
        setCurrentDrawPath([point]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent, point: Point) => {
    if (!isDrawingMode) return;
    
    if (drawingMode === DrawingMode.ERASER) {
      // При движении с зажатой кнопкой мыши тоже проверяем удаление
      if (e.buttons === 1) {
        let foundLine = lines.find(line => isPointNearLine(point, line));
        let foundArrow = !foundLine ? arrows.find(arrow => isPointNearLine(point, arrow)) : undefined;
        // Проверяем пути для свободного рисования
        let foundPath = !foundLine && !foundArrow ? paths.find(path => isPointNearPath(point, path)) : undefined;
        
        if (foundLine && onRemoveDrawing) {
          onRemoveDrawing(foundLine, undefined, undefined);
        } else if (foundArrow && onRemoveDrawing) {
          onRemoveDrawing(undefined, foundArrow, undefined);
        } else if (foundPath && onRemoveDrawing) {
          onRemoveDrawing(undefined, undefined, foundPath);
        }
      }
      return;
    }
    
    if (onDrawMove) {
      e.preventDefault();
      onDrawMove(point);
      
      if (drawingMode === DrawingMode.FREEHAND && isDrawing) {
        // Добавляем точку к текущему пути, но только если она отличается от последней
        if (currentDrawPath.length === 0 || 
            currentDrawPath[currentDrawPath.length - 1].r !== point.r || 
            currentDrawPath[currentDrawPath.length - 1].c !== point.c) {
          setCurrentDrawPath(prev => [...prev, point]);
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent, point: Point) => {
    if (!isDrawingMode) return;
    
    if (drawingMode === DrawingMode.ERASER) {
      return;
    }
    
    if (onDrawEnd) {
      e.preventDefault();
      onDrawEnd(point);
      
      if (drawingMode === DrawingMode.FREEHAND && isDrawing) {
        // Завершаем путь и отправляем его наверх
        if (currentDrawPath.length > 1) {
          const newPath: DrawingPath = {
            points: [...currentDrawPath, point],
            color: "#FF4500",
            thickness: Math.max(2, cellSize / 12)
          };
          
          if (onDrawEnd) {
            onDrawEnd(point);
            setIsDrawing(false);
            setCurrentDrawPath([]);
          }
        } else {
          setIsDrawing(false);
          setCurrentDrawPath([]);
        }
      }
    }
  };

  return (
    <div className="go-board-bg p-2 inline-block rounded shadow-lg">
      <svg
        width={svgSize}
        height={svgSize}
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        aria-label={`Go board, ${boardSize} by ${boardSize} lines`}
      >
        {/* Grid Lines */}
        {Array.from({ length: boardSize }).map((_, i) => (
          <React.Fragment key={`line-${i}`}>
            <line x1={padding} y1={padding + i * cellSize} x2={padding + (boardSize - 1) * cellSize} y2={padding + i * cellSize} stroke="black" strokeWidth="1" aria-hidden="true" />
            <line x1={padding + i * cellSize} y1={padding} x2={padding + i * cellSize} y2={padding + (boardSize - 1) * cellSize} stroke="black" strokeWidth="1" aria-hidden="true" />
          </React.Fragment>
        ))}

        {/* Star Points */}
        {starPoints.map((p, index) => (
          <circle key={`star-${index}`} cx={padding + p.c * cellSize} cy={padding + p.r * cellSize} r={cellSize / 8} fill="black" aria-hidden="true" />
        ))}
        
        {/* Clickable areas - updated to support drawing mode */}
        {Array.from({ length: boardSize }).flatMap((_, r) =>
          Array.from({ length: boardSize }).map((_, c) => {
            const point = { r, c };
            const handleClick = onIntersectionClick ? () => onIntersectionClick(point) : undefined;
            
            const cursorClass = 
              drawingMode === DrawingMode.ERASER ? 'cursor-cell' :
              drawingMode === DrawingMode.FREEHAND ? 'cursor-crosshair' :
              isDrawingMode ? 'cursor-crosshair' : 'cursor-pointer';
            
            return (
              <rect
                key={`click-${r}-${c}`}
                x={padding + c * cellSize - cellSize / 2}
                y={padding + r * cellSize - cellSize / 2}
                width={cellSize}
                height={cellSize}
                fill="transparent"
                className={`${cursorClass} hover:bg-gray-400 hover:bg-opacity-20`}
                onClick={!isDrawingMode ? handleClick : undefined}
                onMouseDown={(e) => handleMouseDown(e, point)}
                onMouseMove={(e) => handleMouseMove(e, point)}
                onMouseUp={(e) => handleMouseUp(e, point)}
                aria-label={`Play at column ${String.fromCharCode(65+c)}, row ${r+1}`}
                style={{ pointerEvents: !isDrawingMode && boardState[r][c] !== StoneColor.Empty ? 'none' : 'auto' }}
              />
            );
          })
        )}

        {/* Stones */}
        {boardState.map((row, r) =>
          row.map((stone, c) => {
            if (stone === StoneColor.Empty) return null;
            const isLastMove = lastMove && lastMove.r === r && lastMove.c === c;
            
            return (
              <g key={`stone-${r}-${c}`} aria-label={`${stone === StoneColor.Black ? 'Black' : 'White'} stone at column ${String.fromCharCode(65+c)}, row ${r+1}${isLastMove ? ', last move' : ''}`}>
                <circle
                  cx={padding + c * cellSize}
                  cy={padding + r * cellSize}
                  r={stoneRadius} 
                  fill={stone === StoneColor.Black ? 'black' : 'white'}
                  stroke={stone === StoneColor.Black ? '#222' : '#ccc'} 
                  strokeWidth="1"
                  className="stone-shadow cursor-pointer"
                  onClick={onIntersectionClick ? () => onIntersectionClick({ r, c }) : undefined}
                />
                {isLastMove && (
                  <circle
                    cx={padding + c * cellSize}
                    cy={padding + r * cellSize}
                    r={cellSize / 6}
                    fill={stone === StoneColor.Black ? 'white' : 'black'}
                    opacity="0.8"
                    aria-hidden="true"
                  />
                )}
              </g>
            );
          })
        )}
        
        {/* Markup Layer - Triangles, Squares, Circles, Marks */}
        {triangles.map((p, i) => renderMarkupSymbol(p, 'triangle', i))}
        {squares.map((p, i) => renderMarkupSymbol(p, 'square', i))}
        {circles.map((p, i) => renderMarkupSymbol(p, 'circle', i))}
        {marks.map((p, i) => renderMarkupSymbol(p, 'mark', i))}

        {/* Labels Layer */}
        {labels.map((labelInfo, index) => {
          const cx = padding + labelInfo.point.c * cellSize;
          const cy = padding + labelInfo.point.r * cellSize;
          const stoneAtLabel = boardState[labelInfo.point.r]?.[labelInfo.point.c];
          let textColor = 'black';
          if (stoneAtLabel === StoneColor.Black) {
            textColor = 'white';
          } else if (stoneAtLabel === StoneColor.White) {
            textColor = 'black';
          } else { // Empty
            textColor = '#0047AB'; // Кобальтовый синий для лучшей видимости
          }
          
          return (
            <g key={`label-group-${index}`}>
              {/* Невидимая кликабельная область для метки */}
              {onIntersectionClick && (
                <circle
                  key={`label-click-${index}`}
                  cx={cx}
                  cy={cy}
                  r={cellSize / 3}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onIntersectionClick(labelInfo.point)}
                  style={{ pointerEvents: 'auto' }}
                />
              )}
              <text
                key={`label-${index}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={stoneRadius * 1.0} // Увеличенный размер текста
                fill={textColor}
                fontWeight="bold"
                filter="drop-shadow(0 0 1px rgba(0,0,0,0.3))"
                className="pointer-events-none select-none"
                aria-label={`Label "${labelInfo.text}" at column ${String.fromCharCode(65+labelInfo.point.c)}, row ${labelInfo.point.r+1}`}
              >
                {labelInfo.text.substring(0,3)} {/* SGF labels typically short */}
              </text>
            </g>
          );
        })}

        {/* Drawing Layer - Линии, стрелки и пути */}
        {lines.map((line, i) => renderLine(line, i))}
        {arrows.map((arrow, i) => renderArrow(arrow, i))}
        {paths.map((path, i) => renderPath(path, i))}
        {isDrawing && renderCurrentPath()}

        {/* Ko Marker */}
        {koPoint && boardState[koPoint.r]?.[koPoint.c] === StoneColor.Empty && (
          <rect
            x={padding + koPoint.c * cellSize - cellSize / 3}
            y={padding + koPoint.r * cellSize - cellSize / 3}
            width={cellSize / 1.5}
            height={cellSize / 1.5}
            fill="red"
            stroke="darkred"
            strokeWidth="1"
            rx={cellSize / 12}
            opacity="0.5"
            aria-label={`Ko point at column ${String.fromCharCode(65+koPoint.c)}, row ${koPoint.r+1}. Playing here is forbidden this turn.`}
            className="pointer-events-none"
          />
        )}
      </svg>
    </div>
  );
};

export default GoBoard;
