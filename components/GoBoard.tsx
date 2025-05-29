
import React from 'react';
import { StoneColor, Point, LabelInfo } from '../types';

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
}) => {
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
    const size = stoneRadius * 0.9; // Relative size for markup
    const strokeColor = "blue"; // Default markup color
    const strokeWidth = Math.max(1, cellSize / 15);

    switch (type) {
      case 'triangle':
        return (
          <polygon
            key={`triangle-${index}`}
            points={`${cx},${cy - size} ${cx - size * 0.866},${cy + size * 0.5} ${cx + size * 0.866},${cy + size * 0.5}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="pointer-events-none"
          />
        );
      case 'square':
        return (
          <rect
            key={`square-${index}`}
            x={cx - size / 1.4}
            y={cy - size / 1.4}
            width={size * 1.4}
            height={size * 1.4}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="pointer-events-none"
          />
        );
      case 'circle':
        return (
          <circle
            key={`circle-${index}`}
            cx={cx}
            cy={cy}
            r={size * 0.8}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="pointer-events-none"
          />
        );
      case 'mark': // X-Mark
        const d = size * 0.7;
        return (
          <React.Fragment key={`mark-${index}`}>
            <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke={strokeColor} strokeWidth={strokeWidth} className="pointer-events-none" />
            <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d} stroke={strokeColor} strokeWidth={strokeWidth} className="pointer-events-none" />
          </React.Fragment>
        );
      default:
        return null;
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
        
        {/* Clickable areas */}
        {onIntersectionClick && Array.from({ length: boardSize }).flatMap((_, r) =>
          Array.from({ length: boardSize }).map((_, c) => (
            <rect
              key={`click-${r}-${c}`}
              x={padding + c * cellSize - cellSize / 2}
              y={padding + r * cellSize - cellSize / 2}
              width={cellSize}
              height={cellSize}
              fill="transparent"
              className="cursor-pointer hover:bg-gray-400 hover:bg-opacity-20"
              onClick={() => onIntersectionClick({ r, c })}
              aria-label={`Play at column ${String.fromCharCode(65+c)}, row ${r+1}`}
            />
          ))
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
                  className="stone-shadow"
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
            textColor = 'hsl(240, 100%, 30%)'; // Dark blue for labels on empty points for visibility
          }
          
          return (
            <text
              key={`label-${index}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={stoneRadius * 0.8} // Adjust size relative to stone
              fill={textColor}
              fontWeight="bold"
              className="pointer-events-none select-none"
              aria-label={`Label "${labelInfo.text}" at column ${String.fromCharCode(65+labelInfo.point.c)}, row ${labelInfo.point.r+1}`}
            >
              {labelInfo.text.substring(0,3)} {/* SGF labels typically short */}
            </text>
          );
        })}


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
