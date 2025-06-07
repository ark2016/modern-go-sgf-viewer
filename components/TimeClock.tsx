import React, { useState, useEffect, useRef } from 'react';
import { StoneColor } from '../types';

interface TimeClockProps {
  isActive: boolean;
  playerTurn: StoneColor.Black | StoneColor.White;
  initialMainTime: number; // в секундах
  byoyomi: number; // в секундах
  periods: number;
  onTimeExpired?: () => void;
}

interface PlayerTimeState {
  mainTime: number; // в секундах
  byoyomiTime: number; // в секундах
  periodsLeft: number;
  isInByoyomi: boolean;
  isExpired: boolean; // флаг для отслеживания, истекло ли время у игрока
}

const TimeClock: React.FC<TimeClockProps> = ({
  isActive,
  playerTurn,
  initialMainTime,
  byoyomi,
  periods,
  onTimeExpired
}) => {
  // Состояние времени для каждого игрока
  const [blackTime, setBlackTime] = useState<PlayerTimeState>({
    mainTime: initialMainTime,
    byoyomiTime: byoyomi,
    periodsLeft: periods,
    isInByoyomi: false,
    isExpired: false
  });
  
  const [whiteTime, setWhiteTime] = useState<PlayerTimeState>({
    mainTime: initialMainTime,
    byoyomiTime: byoyomi,
    periodsLeft: periods,
    isInByoyomi: false,
    isExpired: false
  });
  
  // Для отслеживания интервала
  const timerRef = useRef<number | null>(null);
  
  // Функция для форматирования времени в читаемый вид
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };
  
  // Обновление времени текущего игрока
  const updatePlayerTime = () => {
    const isBlackTurn = playerTurn === StoneColor.Black;
    
    if (isBlackTurn) {
      setBlackTime(prev => {
        // Если время уже истекло, не обновляем его дальше
        if (prev.isExpired) return prev;
        
        // Если основное время закончилось
        if (prev.mainTime <= 0 && !prev.isInByoyomi) {
          // Переходим в бёёми
          return {
            ...prev,
            mainTime: 0,
            isInByoyomi: true
          };
        }
        
        // Если в бёёми и время периода закончилось
        if (prev.isInByoyomi && prev.byoyomiTime <= 0) {
          // Если больше нет периодов
          if (prev.periodsLeft <= 1) {
            // Вызываем onTimeExpired только один раз
            if (!prev.isExpired && onTimeExpired) {
              onTimeExpired();
            }
            return {
              ...prev,
              byoyomiTime: 0,
              periodsLeft: 0,
              isExpired: true
            };
          }
          
          // Восстанавливаем время бёёми и уменьшаем количество периодов
          return {
            ...prev,
            byoyomiTime: byoyomi,
            periodsLeft: prev.periodsLeft - 1
          };
        }
        
        // Обычное уменьшение времени
        if (prev.isInByoyomi) {
          return {
            ...prev,
            byoyomiTime: prev.byoyomiTime - 1
          };
        } else {
          return {
            ...prev,
            mainTime: prev.mainTime - 1
          };
        }
      });
    } else {
      setWhiteTime(prev => {
        // Если время уже истекло, не обновляем его дальше
        if (prev.isExpired) return prev;
        
        // Если основное время закончилось
        if (prev.mainTime <= 0 && !prev.isInByoyomi) {
          // Переходим в бёёми
          return {
            ...prev,
            mainTime: 0,
            isInByoyomi: true
          };
        }
        
        // Если в бёёми и время периода закончилось
        if (prev.isInByoyomi && prev.byoyomiTime <= 0) {
          // Если больше нет периодов
          if (prev.periodsLeft <= 1) {
            // Вызываем onTimeExpired только один раз
            if (!prev.isExpired && onTimeExpired) {
              onTimeExpired();
            }
            return {
              ...prev,
              byoyomiTime: 0,
              periodsLeft: 0,
              isExpired: true
            };
          }
          
          // Восстанавливаем время бёёми и уменьшаем количество периодов
          return {
            ...prev,
            byoyomiTime: byoyomi,
            periodsLeft: prev.periodsLeft - 1
          };
        }
        
        // Обычное уменьшение времени
        if (prev.isInByoyomi) {
          return {
            ...prev,
            byoyomiTime: prev.byoyomiTime - 1
          };
        } else {
          return {
            ...prev,
            mainTime: prev.mainTime - 1
          };
        }
      });
    }
  };
  
  // Восстанавливаем время бёёми при смене игрока
  useEffect(() => {
    // Восстановление бёёми для текущего игрока, если он в режиме бёёми
    if (playerTurn === StoneColor.Black) {
      setBlackTime(prev => {
        if (prev.isInByoyomi && !prev.isExpired) {
          return {
            ...prev,
            byoyomiTime: byoyomi // Сбрасываем бёёми до начального значения
          };
        }
        return prev;
      });
    } else {
      setWhiteTime(prev => {
        if (prev.isInByoyomi && !prev.isExpired) {
          return {
            ...prev,
            byoyomiTime: byoyomi // Сбрасываем бёёми до начального значения
          };
        }
        return prev;
      });
    }
  }, [playerTurn, byoyomi]);
  
  // Управление таймером
  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => {
        updatePlayerTime();
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, playerTurn]);
  
  // Сброс таймера при изменении начальных значений
  useEffect(() => {
    setBlackTime({
      mainTime: initialMainTime,
      byoyomiTime: byoyomi,
      periodsLeft: periods,
      isInByoyomi: false,
      isExpired: false
    });
    
    setWhiteTime({
      mainTime: initialMainTime,
      byoyomiTime: byoyomi,
      periodsLeft: periods,
      isInByoyomi: false,
      isExpired: false
    });
  }, [initialMainTime, byoyomi, periods]);
  
  // Получаем отображаемое время для текущего игрока
  const getDisplayTime = (player: StoneColor.Black | StoneColor.White) => {
    const timeState = player === StoneColor.Black ? blackTime : whiteTime;
    const time = timeState.isInByoyomi ? timeState.byoyomiTime : timeState.mainTime;
    return formatTime(time);
  };
  
  // Получаем статус бёёми для отображения
  const getByoyomiStatus = (player: StoneColor.Black | StoneColor.White) => {
    const timeState = player === StoneColor.Black ? blackTime : whiteTime;
    if (!timeState.isInByoyomi) return null;
    
    return `${timeState.periodsLeft}x`;
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-2 gap-4">
      <div className={`p-3 rounded ${playerTurn === StoneColor.Black ? 'bg-gray-200 dark:bg-gray-700 ring-2 ring-blue-500' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-black mr-2"></div>
            <span className="font-medium dark:text-white">Черные</span>
          </div>
          {blackTime.isInByoyomi && (
            <span className="text-sm bg-yellow-100 dark:bg-yellow-800 px-2 rounded-full text-yellow-800 dark:text-yellow-200">
              {getByoyomiStatus(StoneColor.Black)}
            </span>
          )}
        </div>
        <div className={`mt-2 text-2xl font-bold ${blackTime.isInByoyomi && blackTime.byoyomiTime < 10 ? 'text-red-600 dark:text-red-400' : 'dark:text-white'}`}>
          {getDisplayTime(StoneColor.Black)}
        </div>
      </div>
      
      <div className={`p-3 rounded ${playerTurn === StoneColor.White ? 'bg-gray-200 dark:bg-gray-700 ring-2 ring-blue-500' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-white border border-gray-400 mr-2"></div>
            <span className="font-medium dark:text-white">Белые</span>
          </div>
          {whiteTime.isInByoyomi && (
            <span className="text-sm bg-yellow-100 dark:bg-yellow-800 px-2 rounded-full text-yellow-800 dark:text-yellow-200">
              {getByoyomiStatus(StoneColor.White)}
            </span>
          )}
        </div>
        <div className={`mt-2 text-2xl font-bold ${whiteTime.isInByoyomi && whiteTime.byoyomiTime < 10 ? 'text-red-600 dark:text-red-400' : 'dark:text-white'}`}>
          {getDisplayTime(StoneColor.White)}
        </div>
      </div>
    </div>
  );
};

export default TimeClock; 