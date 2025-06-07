import React, { useState, useEffect } from 'react';
import { StoneColor } from '../types';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGame: (gameSettings: GameSettings) => void;
}

export interface GameSettings {
  boardSize: number;
  komi: number;
  handicap: number;
  playerColor: StoneColor.Black | StoneColor.White;
  timeSettings: {
    enabled: boolean;
    mainTime: number; // в минутах
    byoyomi: number; // в секундах
    periods: number;
  };
  playerBlack: string;
  playerWhite: string;
  rankBlack: string;
  rankWhite: string;
}

const DEFAULT_SETTINGS: GameSettings = {
  boardSize: 19,
  komi: 6.5,
  handicap: 0,
  playerColor: StoneColor.Black,
  timeSettings: {
    enabled: false,
    mainTime: 30,
    byoyomi: 30,
    periods: 5
  },
  playerBlack: 'Игрок 1',
  playerWhite: 'Игрок 2',
  rankBlack: '',
  rankWhite: ''
};

const CreateGameModal: React.FC<CreateGameModalProps> = ({ isOpen, onClose, onCreateGame }) => {
  // Состояние для всех настроек формы
  const [boardSize, setBoardSize] = useState(DEFAULT_SETTINGS.boardSize);
  const [komi, setKomi] = useState(DEFAULT_SETTINGS.komi);
  const [handicap, setHandicap] = useState(DEFAULT_SETTINGS.handicap);
  const [playerColor, setPlayerColor] = useState(DEFAULT_SETTINGS.playerColor);
  const [timeEnabled, setTimeEnabled] = useState(DEFAULT_SETTINGS.timeSettings.enabled);
  const [mainTime, setMainTime] = useState(DEFAULT_SETTINGS.timeSettings.mainTime);
  const [byoyomi, setByoyomi] = useState(DEFAULT_SETTINGS.timeSettings.byoyomi);
  const [periods, setPeriods] = useState(DEFAULT_SETTINGS.timeSettings.periods);
  const [playerBlack, setPlayerBlack] = useState(DEFAULT_SETTINGS.playerBlack);
  const [playerWhite, setPlayerWhite] = useState(DEFAULT_SETTINGS.playerWhite);
  const [rankBlack, setRankBlack] = useState(DEFAULT_SETTINGS.rankBlack);
  const [rankWhite, setRankWhite] = useState(DEFAULT_SETTINGS.rankWhite);
  
  // Сбрасываем настройки к значениям по умолчанию при открытии
  useEffect(() => {
    if (isOpen) {
      setBoardSize(DEFAULT_SETTINGS.boardSize);
      setKomi(DEFAULT_SETTINGS.komi);
      setHandicap(DEFAULT_SETTINGS.handicap);
      setPlayerColor(DEFAULT_SETTINGS.playerColor);
      setTimeEnabled(DEFAULT_SETTINGS.timeSettings.enabled);
      setMainTime(DEFAULT_SETTINGS.timeSettings.mainTime);
      setByoyomi(DEFAULT_SETTINGS.timeSettings.byoyomi);
      setPeriods(DEFAULT_SETTINGS.timeSettings.periods);
      setPlayerBlack(DEFAULT_SETTINGS.playerBlack);
      setPlayerWhite(DEFAULT_SETTINGS.playerWhite);
      setRankBlack(DEFAULT_SETTINGS.rankBlack);
      setRankWhite(DEFAULT_SETTINGS.rankWhite);
    }
  }, [isOpen]);
  
  // Обновляем значение коми при изменении форы
  useEffect(() => {
    if (handicap > 0) {
      setKomi(0.5);
    } else {
      setKomi(6.5);
    }
  }, [handicap]);
  
  // Если модальное окно закрыто, ничего не рендерим
  if (!isOpen) return null;
  
  // Валидация перед отправкой формы
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация для настроек времени
    if (timeEnabled) {
      // Проверяем, что периоды бёёми указаны, если основное время равно 0
      if (mainTime === 0 && (byoyomi === 0 || periods === 0)) {
        alert("Если основное время равно 0, необходимо указать время бёёми и количество периодов больше 0.");
        return;
      }
      
      // Проверяем, что указан хотя бы один тип времени
      if (mainTime === 0 && byoyomi === 0) {
        alert("Должно быть указано основное время или время бёёми.");
        return;
      }
    }
    
    try {
      // Создаем объект с настройками игры
      const gameSettings: GameSettings = {
        boardSize,
        komi,
        handicap,
        playerColor,
        timeSettings: {
          enabled: timeEnabled,
          mainTime,
          byoyomi,
          periods
        },
        playerBlack,
        playerWhite,
        rankBlack,
        rankWhite
      };
      
      // Вызываем функцию создания игры
      onCreateGame(gameSettings);
    } catch (error) {
      console.error("Ошибка при создании игры:", error);
      alert("Произошла ошибка при создании игры. Пожалуйста, попробуйте снова.");
    }
  };
  
  // Предотвращаем закрытие модального окна при клике внутри него
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  // Безопасно преобразуем строку в число
  const parseIntSafe = (value: string): number => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const parseFloatSafe = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 dark:bg-opacity-70"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" 
        onClick={handleModalClick}
      >
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Создать новую игру</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Настройки доски */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">Настройки доски</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Размер доски</label>
                <select 
                  value={boardSize}
                  onChange={(e) => setBoardSize(parseIntSafe(e.target.value))}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value={9}>9×9</option>
                  <option value={13}>13×13</option>
                  <option value={19}>19×19</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Фора (камни)</label>
                <select 
                  value={handicap}
                  onChange={(e) => setHandicap(parseIntSafe(e.target.value))}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value={0}>Нет</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                  <option value={9}>9</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Коми</label>
                <input
                  type="number"
                  value={komi}
                  onChange={(e) => setKomi(parseFloatSafe(e.target.value))}
                  step="0.5"
                  disabled={handicap > 0}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ваш цвет</label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value={StoneColor.Black}
                      checked={playerColor === StoneColor.Black}
                      onChange={() => setPlayerColor(StoneColor.Black)}
                      className="mr-1"
                    />
                    <span className="w-4 h-4 rounded-full bg-black inline-block mr-1"></span>
                    <span className="dark:text-gray-300">Черные</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value={StoneColor.White}
                      checked={playerColor === StoneColor.White}
                      onChange={() => setPlayerColor(StoneColor.White)}
                      className="mr-1"
                    />
                    <span className="w-4 h-4 rounded-full bg-white border border-gray-400 inline-block mr-1"></span>
                    <span className="dark:text-gray-300">Белые</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Информация об игроках */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">Игроки</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Черные</label>
                <input
                  type="text"
                  value={playerBlack}
                  onChange={(e) => setPlayerBlack(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Белые</label>
                <input
                  type="text"
                  value={playerWhite}
                  onChange={(e) => setPlayerWhite(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ранг черных</label>
                <input
                  type="text"
                  value={rankBlack}
                  onChange={(e) => setRankBlack(e.target.value)}
                  placeholder="например, 5k"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ранг белых</label>
                <input
                  type="text"
                  value={rankWhite}
                  onChange={(e) => setRankWhite(e.target.value)}
                  placeholder="например, 1d"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          {/* Настройки времени */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">Настройки времени</h3>
            <div className="mb-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="mr-2"
                />
                <span className="dark:text-gray-300">Использовать контроль времени</span>
              </label>
            </div>
            
            {timeEnabled && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Основное время (мин)</label>
                  <input
                    type="number"
                    value={mainTime}
                    onChange={(e) => setMainTime(parseIntSafe(e.target.value))}
                    min="0"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Бёёми (сек)</label>
                  <input
                    type="number"
                    value={byoyomi}
                    onChange={(e) => setByoyomi(parseIntSafe(e.target.value))}
                    min="0"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Периодов</label>
                  <input
                    type="number"
                    value={periods}
                    onChange={(e) => setPeriods(parseIntSafe(e.target.value))}
                    min="0"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Кнопки действий */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGameModal; 