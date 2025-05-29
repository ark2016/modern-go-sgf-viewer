import React, { useMemo, useRef, useCallback } from 'react';
import { GameTreeNode, StoneColor, Point } from '../types';

interface MoveTreeDisplayProps {
  nodes: Record<string, GameTreeNode>;
  rootId: string;
  activeNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  isEditMode: boolean;
  boardSize: number; 
  activePath: string[]; 
}

const NODE_RADIUS = 12;
const HORIZONTAL_SPACING = NODE_RADIUS * 3.5; 
const VERTICAL_SPACING = NODE_RADIUS * 3;   
const PADDING = 20; 

interface NodePosition {
  id: string;
  x: number;
  y: number;
  moveNumber: number;
  player?: StoneColor.Black | StoneColor.White;
  isVariationBranchPoint?: boolean; 
  isEndOfLine?: boolean; 
}

const MoveTreeDisplay: React.FC<MoveTreeDisplayProps> = ({
  nodes,
  rootId,
  activeNodeId,
  onNodeSelect,
  isEditMode,
  boardSize, 
  activePath: propActivePath, 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeSelect(nodeId);
  }, [onNodeSelect]);


  const { positions, lines, width, height } = useMemo(() => {
    const nodePositions: Record<string, NodePosition> = {};
    const lineElements: { x1: number; y1: number; x2: number; y2: number; isVariation: boolean }[] = [];
    let globalMaxX = PADDING; // Tracks the overall maximum X extent for SVG width (edge of node)
    let globalMaxY = PADDING; // Tracks the overall maximum Y extent for SVG height (edge of node)

    const layoutNodeRecursive = (
        nodeId: string,
        nodeDrawX: number, // The X coordinate where this current node's center will be drawn
        nodeDrawY: number, // The Y coordinate where this current node's center will be drawn
        parentPosIfAny: NodePosition | null,
        isLineToThisNodeAVariationBranch: boolean // True if the link from parent to this node represents a variation step
    ): number => { // Returns the maximum X-coordinate (center of node) of any node in the subtree rooted here.
    
        const node = nodes[nodeId];
        if (!node) {
            console.error(`[MoveTreeDisplay] Node ${nodeId} not found during layout!`);
            // Return a sensible default or throw error
            return nodeDrawX; 
        }

        const currentPosition: NodePosition = {
            id: nodeId,
            x: nodeDrawX,
            y: nodeDrawY,
            moveNumber: node.moveNumber > 0 ? node.moveNumber : (node.parentId && nodes[node.parentId] ? nodes[node.parentId]!.moveNumber || 0 : 0),
            player: node.player,
            isEndOfLine: node.childrenIds.length === 0,
            isVariationBranchPoint: node.childrenIds.length > 1,
        };
        nodePositions[nodeId] = currentPosition;

        globalMaxX = Math.max(globalMaxX, nodeDrawX + NODE_RADIUS);
        globalMaxY = Math.max(globalMaxY, nodeDrawY + NODE_RADIUS);

        if (parentPosIfAny) {
            lineElements.push({
                x1: parentPosIfAny.x, y1: parentPosIfAny.y,
                x2: currentPosition.x, y2: currentPosition.y,
                isVariation: isLineToThisNodeAVariationBranch,
            });
        }

        let maxNodeCenterXInThisSubtree = nodeDrawX; // Max X-center for the subtree rooted at *this* node
        let currentXBoundaryForNextSiblingCenter = nodeDrawX; // Tracks the X-center of the rightmost node from the *previous* sibling's subtree

        node.childrenIds.forEach((childId, index) => {
            const isThisChildTheMainContinuation = index === 0;
            let childDrawX;
    
            if (isThisChildTheMainContinuation) {
                // Main child is drawn directly below the current node (shares same X).
                childDrawX = nodeDrawX;
            } else {
                // This child is a variation. It starts to the right of the previous sibling's entire subtree.
                // currentXBoundaryForNextSiblingCenter holds the max X-center from the previous sibling's layout.
                childDrawX = currentXBoundaryForNextSiblingCenter + HORIZONTAL_SPACING;
            }
    
            const maxNodeCenterXInChildSubtree = layoutNodeRecursive(
                childId,
                childDrawX,
                nodeDrawY + VERTICAL_SPACING, // Children are always one level down
                currentPosition,
                !isThisChildTheMainContinuation // Line to child is variation if child is not main continuation
            );
            
            // Update the X boundary for the *next* sibling based on the max X-center of the child we just processed.
            currentXBoundaryForNextSiblingCenter = Math.max(currentXBoundaryForNextSiblingCenter, maxNodeCenterXInChildSubtree);
            // Update the overall max X-center for the current node's subtree.
            maxNodeCenterXInThisSubtree = Math.max(maxNodeCenterXInThisSubtree, maxNodeCenterXInChildSubtree);
        });
    
        return maxNodeCenterXInThisSubtree;
    };
    
    if (nodes[rootId]) {
        layoutNodeRecursive(rootId, PADDING + NODE_RADIUS, PADDING + NODE_RADIUS, null, false);
    }

    const finalWidth = Math.max(globalMaxX + PADDING, 300);
    const finalHeight = Math.max(globalMaxY + PADDING, 150);
    
    return { positions: Object.values(nodePositions), lines: lineElements, width: finalWidth, height: finalHeight };
  }, [nodes, rootId]); // Removed propActivePath and boardSize as direct deps for layout logic, they affect styling/data


  if (!nodes || !nodes[rootId]) {
    return <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-gray-500 dark:text-gray-400">Loading or no game tree...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-[calc(100vh-200px)] overflow-auto">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 p-3 border-b border-gray-300 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
        Move Tree (Top-Down Graph)
      </h3>
      <svg ref={svgRef} width={width} height={height} >
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
                markerUnits="strokeWidth" markerWidth="8" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" /> {/* gray-400 */}
            </marker>
        </defs>
        {lines.map((line, index) => (
          <line
            key={`line-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.isVariation ? "#fbbf24" : "#9ca3af"} // amber-400 for variations, gray-400 for main
            strokeWidth={line.isVariation ? 1.5 : 2}
            // markerEnd="url(#arrow)" // Optional: add arrows to lines
          />
        ))}
        {positions.map((pos) => {
          const node = nodes[pos.id];
          if (!node) return null;

          const isActive = activeNodeId === pos.id;
          const isOnActivePath = propActivePath.includes(pos.id);
          let circleFill = "white";
          let textFill = "black";
          let strokeColor = "#6b7280"; // gray-500

          if (node.player === StoneColor.Black) {
            circleFill = "black";
            textFill = "white";
          } else if (node.player === StoneColor.White) {
            circleFill = "white";
            textFill = "black";
            strokeColor = "black"; 
          } else { 
            circleFill = "#e5e7eb"; // gray-200 for non-move nodes (root, setup)
            textFill = "#374151"; // gray-700
            strokeColor = "#9ca3af"; // gray-400
          }

          if (isActive) {
            strokeColor = "#3b82f6"; // blue-500
          } else if (isOnActivePath && !isActive) { 
            strokeColor = "#2563eb"; // A slightly different shade for active path but not current node
          }
          
          // Display 'S' for root/setup, 'C' if comment only, else move number
          const displayMoveNumber = node.moveNumber > 0 
            ? String(node.moveNumber) 
            : (node.sgfProps?.C && Object.keys(node.sgfProps).length === 1 && node.sgfProps.C.length > 0 && !node.sgfProps.B && !node.sgfProps.W && !node.sgfProps.AB && !node.sgfProps.AW && !node.sgfProps.AE) 
              ? "C" // Only a comment node
              : "S"; // Setup/Root or other non-move SGF properties node

          return (
            <g
              key={pos.id}
              transform={`translate(${pos.x},${pos.y})`}
              onClick={() => handleNodeClick(pos.id)}
              className="cursor-pointer group"
              aria-label={`Move ${displayMoveNumber}${node.player ? ' by ' + node.player : ''}`}
              role="button"
              tabIndex={0} 
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNodeClick(pos.id);}}
            >
              <circle
                r={NODE_RADIUS}
                fill={circleFill}
                stroke={strokeColor}
                strokeWidth={isActive ? 3 : (isOnActivePath ? 2.5 : 1.5)}
                className="group-hover:opacity-80 transition-all"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dy=".3em" 
                fontSize="10px"
                fontWeight={isActive ? "bold" : "normal"}
                fill={textFill}
                className="pointer-events-none select-none" 
              >
                {displayMoveNumber}
              </text>
              {node.comment && displayMoveNumber !== "C" && ( // Show 'C' marker if there's a comment AND it's not already a 'C' display node
                <text 
                  x={NODE_RADIUS * 0.8} 
                  y={-NODE_RADIUS * 0.8} 
                  fontSize="9px" 
                  fill={isActive ? (node.player === StoneColor.Black ? "white" : "blue") : (isOnActivePath ? "blue-300" : "blue-500")} 
                  dominantBaseline="middle" 
                  textAnchor="middle"
                  className="pointer-events-none font-bold select-none"
                  aria-hidden="true"
                >
                  C
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default MoveTreeDisplay;
