
import React, { useState } from 'react';
import { SgfGameInfo, StoneColor, ParsedMove } from '../types'; // ParsedMove is now an adapter
import { PLAYER_COLOR_MAP } from '../constants';

interface GameInfoProps {
  info: SgfGameInfo | null;
  currentMoveData?: ParsedMove | null; // Represents data from the current GameTreeNode
  currentPlayerTurn?: StoneColor.Black | StoneColor.White; // Actual current player (whose turn it is NEXT)
  isEditMode: boolean;
  editModePlayerTurn?: StoneColor.Black | StoneColor.White; // Player turn in edit mode
  editModeCaptures?: { black: number; white: number }; // Captures made during edit mode
}

const InfoItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value))) return null;
  return (
    <div>
      <span className="font-semibold text-gray-700 dark:text-gray-300">{label}:</span>{' '}
      <span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
    </div>
  );
};

const Spoiler: React.FC<{ summary: string; children: React.ReactNode }> = ({ summary, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none font-semibold"
                aria-expanded={isOpen}
            >
                {isOpen ? 'Hide' : summary} {isOpen ? '▲' : '▼'}
            </button>
            {isOpen && <div className="mt-1 ml-2 text-gray-600 dark:text-gray-400">{children}</div>}
        </div>
    );
};


const GameInfo: React.FC<GameInfoProps> = ({ 
    info, 
    currentMoveData, 
    currentPlayerTurn,
    isEditMode,
    editModePlayerTurn,
    editModeCaptures
}) => {
  if (!info && !isEditMode) {
    return <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-center text-gray-500 dark:text-gray-400">No SGF loaded. Use controls.</div>;
  }
   if (isEditMode && !info) {
     return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-2">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 border-b pb-2 mb-3 dark:border-gray-700">Edit Mode (New Game)</h3>
            <InfoItem label="Board Size" value={ "19x19 (Default)" } />
             {editModePlayerTurn && (
                <div className="pt-2">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Current Turn:</h4>
                <div className="flex items-center space-x-2">
                    <span 
                    className={`w-5 h-5 rounded-full ${editModePlayerTurn === StoneColor.Black ? 'bg-black' : 'bg-white border border-gray-400'}`}
                    aria-hidden="true"
                    ></span>
                    <span className="dark:text-gray-200">{PLAYER_COLOR_MAP[editModePlayerTurn]}</span>
                </div>
                </div>
            )}
            {editModeCaptures && (
                 <div className="pt-2 border-t mt-3 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Captures (Edit Mode):</h4>
                    <InfoItem label="Black captured (White stones)" value={editModeCaptures.black} />
                    <InfoItem label="White captured (Black stones)" value={editModeCaptures.white} />
                </div>
            )}
        </div>
     );
   }

  const displayPlayerB = info?.playerBlack || (isEditMode ? "Player 1" : "Black");
  const displayPlayerW = info?.playerWhite || (isEditMode ? "Player 2" : "White");
  
  const displayCapturedByBlack = isEditMode ? (editModeCaptures?.black ?? 0) : (currentMoveData?.totalCapturedByBlack ?? 0);
  const displayCapturedByWhite = isEditMode ? (editModeCaptures?.white ?? 0) : (currentMoveData?.totalCapturedByWhite ?? 0);
  const displayTurn = isEditMode ? editModePlayerTurn : currentPlayerTurn;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-2">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 border-b pb-2 mb-3 dark:border-gray-700">
        {isEditMode ? "Game Information (Editing)" : (info?.name || "Game Information")}
      </h3>
      
      {info && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
            <InfoItem label="Black" value={`${displayPlayerB} ${info.rankBlack ? '('+info.rankBlack+')' : ''}`} />
            <InfoItem label="White" value={`${displayPlayerW} ${info.rankWhite ? '('+info.rankWhite+')' : ''}`} />
          </div>
          <InfoItem label="Board Size" value={`${info.boardSize}x${info.boardSize}`} />
          {info.komi !== undefined && <InfoItem label="Komi" value={info.komi} />}
          {info.handicap !== undefined && info.handicap > 0 && <InfoItem label="Handicap" value={info.handicap} />}
          <InfoItem label="Date" value={info.date} />
          {info.result && (
            <Spoiler summary="Result">
                <InfoItem label="Result" value={info.result} />
            </Spoiler>
          )}
          <InfoItem label="Ruleset" value={info.ruleset} />
        </>
      )}
      
      <div className="pt-2 border-t mt-3 dark:border-gray-700">
        <h4 className="font-semibold text-gray-700 dark:text-gray-300">Captures{isEditMode ? " (Session)" : ""}:</h4>
        <InfoItem label={`${PLAYER_COLOR_MAP[StoneColor.Black]} captured`} value={displayCapturedByBlack} />
        <InfoItem label={`${PLAYER_COLOR_MAP[StoneColor.White]} captured`} value={displayCapturedByWhite} />
      </div>

      {displayTurn && (
        <div className="pt-2 border-t mt-3 dark:border-gray-700">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300">Current Turn:</h4>
          <div className="flex items-center space-x-2">
            <span 
              className={`w-5 h-5 rounded-full ${displayTurn === StoneColor.Black ? 'bg-black' : 'bg-white border border-gray-400'}`}
              aria-hidden="true"
            ></span>
            <span className="dark:text-gray-200">{PLAYER_COLOR_MAP[displayTurn]}</span>
          </div>
        </div>
      )}
      {info?.sgfComment && !isEditMode && (
         <div className="pt-2 border-t mt-3 dark:border-gray-700">
            <h4 className="font-semibold text-gray-700 dark:text-gray-300">Game Comment:</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 italic whitespace-pre-wrap">{info.sgfComment}</p>
        </div>
      )}
    </div>
  );
};

export default GameInfo;
