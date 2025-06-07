import React from 'react';
import { StoneColor } from '../types';

interface GameControlsProps {
  isEditMode: boolean;
  timeControlEnabled: boolean;
  isClockActive: boolean;
  currentPlayer: StoneColor.Black | StoneColor.White;
  onPass: () => void;
  onPauseResumeClock: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  isEditMode,
  timeControlEnabled,
  isClockActive,
  currentPlayer,
  onPass,
  onPauseResumeClock
}) => {
  if (!isEditMode) return null;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-2 mb-2 dark:border-gray-700">
        Управление игрой
      </h3>
      
      <div className="flex justify-between items-center">
        <div>
          <span className="mr-2 dark:text-gray-300">Ход:</span>
          <span className="font-medium flex items-center">
            <span 
              className={`w-4 h-4 rounded-full inline-block mr-1 ${
                currentPlayer === StoneColor.Black 
                  ? 'bg-black' 
                  : 'bg-white border border-gray-400'
              }`}
            ></span>
            <span className="dark:text-white">
              {currentPlayer === StoneColor.Black ? 'Черных' : 'Белых'}
            </span>
          </span>
        </div>
        
        <button
          onClick={onPass}
          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
        >
          Пропустить ход
        </button>
      </div>
      
      {timeControlEnabled && (
        <div className="border-t pt-3 dark:border-gray-700">
          <button
            onClick={onPauseResumeClock}
            className={`w-full px-3 py-2 rounded text-white transition-colors ${
              isClockActive 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isClockActive ? 'Остановить часы' : 'Запустить часы'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GameControls; 