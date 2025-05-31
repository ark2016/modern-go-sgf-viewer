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

  const handleMouseDown = (e: React.MouseEvent, point: Point) => {
    if (!isDrawingMode) return;
    
    if (drawingMode === DrawingMode.ERASER) {
      // Проверяем, нужно ли удалить линию или стрелку
      let foundLine = lines.find(line => isPointNearLine(point, line));
      let foundArrow = !foundLine ? arrows.find(arrow => isPointNearLine(point, arrow)) : undefined;
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