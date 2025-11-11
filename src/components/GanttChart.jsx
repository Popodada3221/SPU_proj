import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Portal from './Portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateDailyLoad } from '../utils/resourceCalculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  BarChart2,
  Download,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Hourglass,
  Maximize,
  X,
  Undo2
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ru } from 'date-fns/locale';

const GanttChart = forwardRef(({results, project, onTaskUpdate, onUndo, onReset, canUndo, userOverrides  }, ref) => {
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showTimeScale, setShowTimeScale] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [showTimeReserves, setShowTimeReserves] = useState(true); 
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [resourceLoadData, setResourceLoadData] = useState([]);
  const [draggingTask, setDraggingTask] = useState(null); 
  const [dragOffset, setDragOffset] = useState(0); 
  const [isFullScreen, setIsFullScreen] = useState(false);

 useImperativeHandle(ref, () => ({
  getAsBase64: () => {
    if (!results || !results.tasks || !results.tasks.length) {
      console.error("Нет данных для генерации диаграммы Ганта.");
      return null;
    }

    try {
      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d');

    
      const fullChartWidth = LABEL_WIDTH + projectDuration * DAY_WIDTH;
      const fullChartHeight = HEADER_HEIGHT + results.tasks.length * ROW_HEIGHT;
      
      const dpr = 2; 
      offscreenCanvas.width = fullChartWidth * dpr;
      offscreenCanvas.height = fullChartHeight * dpr;
      ctx.scale(dpr, dpr);


      const originalScale = scale;
      const originalOffset = scrollOffset;
      

      setScale(1);
      setScrollOffset({ x: 0, y: 0 });
      
  
      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, fullChartWidth, fullChartHeight);
      if (showTimeScale) drawTimeScale(ctx, fullChartWidth);
      drawGrid(ctx, fullChartWidth, fullChartHeight);
      results.tasks.forEach((task, index) => {
        drawTask(ctx, task, index, fullChartWidth);
      });
      drawBorders(ctx, fullChartWidth, fullChartHeight);

      setScale(originalScale);
      setScrollOffset(originalOffset);

      return offscreenCanvas.toDataURL('image/png', 1.0);

    } catch (e) {
      console.error("Ошибка при создании base64 из диаграммы Ганта:", e);
      return null;
    }
  },
}));

  const tasks = results?.tasks || [];
  const projectDuration = results?.projectDuration || 0;
  const criticalPath = results?.criticalPath || [];


  const TASK_HEIGHT = 32;
  const TASK_MARGIN = 6;
  const ROW_HEIGHT = TASK_HEIGHT + TASK_MARGIN * 2;
  const HEADER_HEIGHT = 80;
  const LABEL_WIDTH = 320;
  const DAY_WIDTH = 50;
  const GRID_COLOR = '#f1f5f9';
  const BORDER_COLOR = '#e2e8f0';
  const CRITICAL_COLOR = '#ef4444';
  const NORMAL_COLOR = '#3b82f6';
  const BACKGROUND_COLOR = '#ffffff';
  const HEADER_COLOR = '#f8fafc';

  
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.max(0.2, Math.min(prev * delta, 5)));
    }
  }, []);

 

const handleMouseDown = useCallback((e) => {
  const canvas = canvasRef.current;
  if (!canvas || e.button !== 0) return;
  e.preventDefault();

	  const rect = canvas.getBoundingClientRect();
	  const x = (e.clientX - rect.left) / scale - scrollOffset.x;
	  const y = (e.clientY - rect.top) / scale - scrollOffset.y;

  const taskIndex = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);
  const task = tasks[taskIndex];

  if (task && !task.isCritical && !task.isDummy) {
    const taskStartPixel = LABEL_WIDTH + task.earlyStart * DAY_WIDTH;
    const taskEndPixel = taskStartPixel + task.duration * DAY_WIDTH;

    if (x >= taskStartPixel && x <= taskEndPixel) {
      setDraggingTask({
        task: task,
        initialX: e.clientX,
        initialStart: task.earlyStart,
      });
      canvas.style.cursor = 'grabbing';
      return; 
    }
  }

  setIsPanning(true);
  setPanStart({ x: e.clientX - scrollOffset.x * scale, y: e.clientY - scrollOffset.y * scale });
  canvas.style.cursor = 'grabbing';

}, [tasks, scale, scrollOffset]);

const handleMouseMove = useCallback((e) => {
		  if (draggingTask) {
		    const canvas = canvasRef.current;
		    const rect = canvas.getBoundingClientRect();
		    
		    const dx = e.clientX - draggingTask.initialX;
		    const dayDelta = dx / (DAY_WIDTH * scale); 
		    let newStart = draggingTask.initialStart + dayDelta;

    const minStart = draggingTask.task.earlyStart;
    const maxStart = draggingTask.task.lateStart;
    newStart = Math.max(minStart, Math.min(newStart, maxStart));
    
    setDragOffset(newStart - draggingTask.initialStart);
    return; 
  }

  if (isPanning) {
    setScrollOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
    }));
  }
}, [isPanning, draggingTask, scale]);

const handleMouseUp = useCallback(() => {
  if (draggingTask) {

	  const finalStartDay = Math.round(draggingTask.initialStart + dragOffset);
	
	  if (finalStartDay !== draggingTask.task.userDefinedStart) {
	    onTaskUpdate(draggingTask.task.id, {
	      userDefinedStart: finalStartDay,
	    });
	  }

    setDraggingTask(null);
    setDragOffset(0);
  }
  
  setIsPanning(false);
  if (canvasRef.current) {
    canvasRef.current.style.cursor = 'grab';
  }
}, [draggingTask, dragOffset, onTaskUpdate]);
 

  useEffect(() => {
  if (results && results.tasks) {
    const loadData = calculateDailyLoad(results.tasks, results.projectDuration);
    setResourceLoadData(loadData);
  }
}, [results]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  


  useEffect(() => {
    if (tasks.length > 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(drawGanttChart);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [tasks, showCriticalPath, showTimeScale, showResources, showTimeReserves, scale, scrollOffset]);

  const drawGanttChart = () => {
  const canvas = canvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container || !results || !results.tasks || results.tasks.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const ganttAreaHeight = HEADER_HEIGHT + results.tasks.length * ROW_HEIGHT;
  const resourceChartHeight = 200;
  const resourceChartPaddingTop = 60; 

  const requiredHeight = ganttAreaHeight + resourceChartHeight + resourceChartPaddingTop;
  const chartHeight = Math.max(container.offsetHeight, requiredHeight);
  const chartWidth = Math.max(container.offsetWidth, LABEL_WIDTH + results.projectDuration * DAY_WIDTH * scale);

  canvas.width = chartWidth * dpr;
  canvas.height = chartHeight * dpr;
  canvas.style.width = `${chartWidth}px`;
  canvas.style.height = `${chartHeight}px`;

  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;

  ctx.save();
  ctx.translate(scrollOffset.x, scrollOffset.y);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(-scrollOffset.x, -scrollOffset.y, chartWidth, chartHeight);

  if (showTimeScale) {
    drawTimeScale(ctx, chartWidth, chartHeight);
  }

  drawGrid(ctx, chartWidth, chartHeight); 

  results.tasks.forEach((task, index) => {
    drawTask(ctx, task, index, chartWidth);
  });

  drawBorders(ctx, chartWidth, ganttAreaHeight);

 
  const resourceAreaY = ganttAreaHeight + resourceChartPaddingTop;
  
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
 
	  ctx.fillText('Загрузка ресурсов (чел/день)', 15 - scrollOffset.x, ganttAreaHeight + 25 - scrollOffset.y);
	  
	  ctx.fillStyle = '#6b7280';
	  ctx.font = '12px Arial';
	  ctx.textAlign = 'left';
	  ctx.textBaseline = 'middle';
	  ctx.fillText('Квалификации:', 15 - scrollOffset.x, resourceAreaY - 40);
	  ctx.fillText('Всего (текущая)', 15 - scrollOffset.x, resourceAreaY - 25);

  const maxLoad = Math.max(...resourceLoadData.map(d => d.load), 0);
  const yAxisMax = Math.ceil(maxLoad / 5) * 5 || 5;
  const resourceGraphHeight = resourceChartHeight - 50; 

  ctx.save();
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.translate(LABEL_WIDTH - 40, resourceAreaY + resourceGraphHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Исполнители (чел.)', 0, 0);
  ctx.restore();

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LABEL_WIDTH, resourceAreaY);
  ctx.lineTo(LABEL_WIDTH, resourceAreaY + resourceGraphHeight);
  ctx.stroke();

  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const value = Math.round((yAxisMax / numTicks) * i);
    const y = resourceAreaY + resourceGraphHeight - (value / yAxisMax) * resourceGraphHeight;

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, LABEL_WIDTH - 10, y);

    ctx.beginPath();
    ctx.strokeStyle = '#e5e7eb';
    ctx.moveTo(LABEL_WIDTH, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  const bottomAxisY = resourceAreaY + resourceGraphHeight + 15;
  for (let day = 0; day <= projectDuration; day++) {
    if (day % 5 === 0) { 
      const x = LABEL_WIDTH + day * DAY_WIDTH * scale + (DAY_WIDTH * scale / 2);
      ctx.fillText(day, x, bottomAxisY);
    }
  }
  ctx.fillStyle = '#6b7280';
ctx.font = '12px Arial';
ctx.textAlign = 'center';
ctx.fillText('Дни проекта', LABEL_WIDTH + (chartWidth - LABEL_WIDTH) / 2, bottomAxisY + 20);


	  ctx.strokeStyle = '#2563eb'; 
	  ctx.lineWidth = 2;
	  ctx.beginPath();
	
	  resourceLoadData.forEach((data, index) => {
	    const x = LABEL_WIDTH + data.day * DAY_WIDTH * scale + (DAY_WIDTH * scale / 2);
	    const y = resourceAreaY + resourceGraphHeight - (data.load / yAxisMax) * resourceGraphHeight;
	    
	    if (index === 0) {
	      ctx.moveTo(x, y);
	    } else {
	      ctx.lineTo(x, y);
	    }
	  });
	  
	  ctx.stroke();

	  ctx.fillStyle = '#2563eb';
	  resourceLoadData.forEach(data => {
	    const x = LABEL_WIDTH + data.day * DAY_WIDTH * scale + (DAY_WIDTH * scale / 2);
	    const y = resourceAreaY + resourceGraphHeight - (data.load / yAxisMax) * resourceGraphHeight;
	    ctx.beginPath();
	    ctx.arc(x, y, 3, 0, 2 * Math.PI);
	    ctx.fill();
	  });
	  
	  ctx.fillStyle = '#111827';
	  ctx.font = 'bold 14px Arial';
	  ctx.textAlign = 'center';
	  ctx.textBaseline = 'middle';
	  ctx.fillText('Суммарная загрузка исполнителей (чел/день)', LABEL_WIDTH + (chartWidth - LABEL_WIDTH) / 2, resourceAreaY - 15);

  ctx.restore();
};



  const drawTimeScale = (ctx, chartWidth,chartHeight) => {
    const timeScaleY = 0;
    const timeScaleHeight = HEADER_HEIGHT;

    
    ctx.fillStyle = HEADER_COLOR;
    ctx.fillRect(-scrollOffset.x, timeScaleY, chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);

    
    const gradient = ctx.createLinearGradient(0, timeScaleY, 0, timeScaleHeight);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f8fafc');
    ctx.fillStyle = gradient;
    ctx.fillRect(-scrollOffset.x, timeScaleY, chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);

    
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-scrollOffset.x, timeScaleHeight);
    ctx.lineTo(chartWidth + Math.abs(scrollOffset.x), timeScaleHeight);
    ctx.stroke();

  
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startX = LABEL_WIDTH;
    const dayWidth = DAY_WIDTH * scale;

  
    for (let day = 0; day <= projectDuration; day++) {
      const x = startX + day * dayWidth;
      
      if (x > chartWidth + Math.abs(scrollOffset.x)) break;
      if (x < -Math.abs(scrollOffset.x) - dayWidth) continue;

      
      ctx.strokeStyle = day % 5 === 0 ? '#cbd5e1' : '#e2e8f0';
      ctx.lineWidth = day % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartHeight);
      ctx.stroke();

      
      if (dayWidth > 25) {
        ctx.fillStyle = day % 5 === 0 ? '#1f2937' : '#6b7280';
        ctx.font = day % 5 === 0 ? 'bold 12px sans-serif' : '11px sans-serif';
        ctx.fillText(`${day}`, x, timeScaleHeight - 20);
      }
    }

    
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Время (дни)', startX + (projectDuration * dayWidth) / 2, 25);

    ctx.textAlign = 'left';
    ctx.fillText('Задачи', 15, 25);

   
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, timeScaleHeight);
    ctx.stroke();
  };

 const drawTask = (ctx, task, index, chartWidth) => {
  const y = HEADER_HEIGHT + index * ROW_HEIGHT;
  const taskY = y + TASK_MARGIN;

  ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#fafbfc';
  ctx.fillRect(-scrollOffset.x, y, chartWidth + Math.abs(scrollOffset.x), ROW_HEIGHT);

  ctx.fillStyle = '#1f2937';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  const taskLabel = `${task.id}. ${task.name || 'Без названия'}`;
  const maxLabelWidth = LABEL_WIDTH - 30;
  const truncatedLabel = truncateText(ctx, taskLabel, maxLabelWidth);
  ctx.fillText(truncatedLabel, 15, taskY + TASK_HEIGHT / 2);

	  if (showResources && task.numberOfPerformers) {
	    ctx.fillStyle = '#6b7280';
	    ctx.font = '11px sans-serif';
	    ctx.fillText(`👥 ${task.numberOfPerformers} исп.`, 15, taskY + TASK_HEIGHT / 2 + 16);
	  }

  let currentStart = task.earlyStart || 0;
  if (draggingTask && draggingTask.task.id === task.id) {
     currentStart = draggingTask.initialStart + dragOffset;
  }

  const startX = LABEL_WIDTH + currentStart * DAY_WIDTH * scale;
  const taskWidth = task.duration * DAY_WIDTH * scale;
  
  if (startX < chartWidth + Math.abs(scrollOffset.x) && startX + taskWidth > -Math.abs(scrollOffset.x)) {
	    const isCritical = showCriticalPath && (criticalPath.includes(task.id) || task.isCritical);
    
    if (showTimeReserves && !isCritical && !task.isDummy) {
      const reserveX = LABEL_WIDTH + task.earlyStart * DAY_WIDTH * scale;
      const reserveWidth = (task.lateFinish - task.earlyStart) * DAY_WIDTH * scale;
      ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.fillRect(reserveX, y, reserveWidth, ROW_HEIGHT);
    }
    
    const gradient = ctx.createLinearGradient(startX, taskY, startX, taskY + TASK_HEIGHT);
    if (isCritical) {
      gradient.addColorStop(0, '#f87171');
      gradient.addColorStop(1, '#dc2626');
    } else {
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(1, '#2563eb');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
    
    ctx.strokeStyle = isCritical ? '#b91c1c' : '#1d4ed8';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, taskY, Math.min(taskWidth, chartWidth - startX), TASK_HEIGHT);
    
    if (taskWidth > 60) {
      const textX = startX + Math.min(taskWidth, chartWidth - startX) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillText(`${task.duration}д`, textX + 1, taskY + TASK_HEIGHT / 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${task.duration}д`, textX, taskY + TASK_HEIGHT / 2);
    }
  }

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-scrollOffset.x, y + ROW_HEIGHT);
  ctx.lineTo(chartWidth + Math.abs(scrollOffset.x), y + ROW_HEIGHT);
  ctx.stroke();
};

	  const drawGrid = (ctx, chartWidth, chartHeight) => {
	  ctx.strokeStyle = GRID_COLOR;
	  ctx.lineWidth = 1;

	  for (let i = 0; i < tasks.length; i++) {
	    const y = HEADER_HEIGHT + i * ROW_HEIGHT;
	    ctx.beginPath();
	    ctx.moveTo(0, y);
	    ctx.lineTo(chartWidth, y);
	    ctx.stroke();
	  }

	  const startDay = Math.floor(-scrollOffset.x / (DAY_WIDTH * scale));
	  const endDay = Math.min(
	    projectDuration,
	    startDay + Math.ceil(containerRef.current.offsetWidth / (DAY_WIDTH * scale)) + 2
	  );
	
	  for (let day = startDay; day <= endDay; day++) {
	    if (day < 0) continue;
	    const x = LABEL_WIDTH + day * DAY_WIDTH * scale;
	    ctx.beginPath();
	    ctx.moveTo(x, 0);
	    ctx.lineTo(x, chartHeight);
	    ctx.stroke();
	  }
	};

  const drawBorders = (ctx, chartWidth, chartHeight) => {
    
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, chartHeight);
    ctx.stroke();

  
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(-scrollOffset.x, -scrollOffset.y, chartWidth + Math.abs(scrollOffset.x), chartHeight + Math.abs(scrollOffset.y));
  };

  const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
  };

  const exportToPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const exportToSVG = () => {
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const chartWidth = Math.max(containerWidth, LABEL_WIDTH + projectDuration * DAY_WIDTH * scale);
    const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

    let svg = `<svg width="${chartWidth}" height="${chartHeight}" xmlns="http://www.w3.org/2000/svg">`;
    
  
    svg += `<rect width="${chartWidth}" height="${chartHeight}" fill="${BACKGROUND_COLOR}"/>`;
    
    
    const headerGradient = `<defs><linearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" /><stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" /></linearGradient></defs>`;
    svg += headerGradient;
    svg += `<rect width="${chartWidth}" height="${HEADER_HEIGHT}" fill="url(#headerGrad)"/>`;
    svg += `<text x="15" y="25" font-family="Arial" font-size="16" font-weight="bold" fill="#1f2937">Задачи</text>`;
    svg += `<text x="${LABEL_WIDTH + (projectDuration * DAY_WIDTH * scale) / 2}" y="25" font-family="Arial" font-size="16" font-weight="bold" fill="#1f2937" text-anchor="middle">Время (дни)</text>`;
    
   
    for (let day = 0; day <= projectDuration; day++) {
      const x = LABEL_WIDTH + day * DAY_WIDTH * scale;
      if (x > chartWidth) break;
      
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="${HEADER_HEIGHT}" stroke="${day % 5 === 0 ? '#cbd5e1' : '#e2e8f0'}" stroke-width="${day % 5 === 0 ? 2 : 1}"/>`;
      if (DAY_WIDTH * scale > 25) {
        svg += `<text x="${x}" y="${HEADER_HEIGHT - 20}" font-family="Arial" font-size="${day % 5 === 0 ? 12 : 11}" font-weight="${day % 5 === 0 ? 'bold' : 'normal'}" fill="${day % 5 === 0 ? '#1f2937' : '#6b7280'}" text-anchor="middle">${day}</text>`;
      }
    }
    
   
    tasks.forEach((task, index) => {
      const y = HEADER_HEIGHT + index * ROW_HEIGHT;
      const taskY = y + TASK_MARGIN;
      
     
      svg += `<rect x="0" y="${y}" width="${chartWidth}" height="${ROW_HEIGHT}" fill="${index % 2 === 0 ? '#ffffff' : '#fafbfc'}"/>`;
      
      
      const taskLabel = `${task.id}. ${task.name || 'Без названия'}`;
      svg += `<text x="15" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="13" fill="#1f2937" dominant-baseline="middle">${taskLabel}</text>`;
      
    
      const startX = LABEL_WIDTH + (task.earlyStart || 0) * DAY_WIDTH * scale;
      const taskWidth = task.duration * DAY_WIDTH * scale;
      const isCritical = criticalPath.includes(task.id) || task.isCritical;
      
      if (startX < chartWidth) {
        const gradientId = `taskGrad${index}`;
        svg += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">`;
        if (isCritical) {
          svg += `<stop offset="0%" style="stop-color:#f87171;stop-opacity:1" /><stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />`;
        } else {
          svg += `<stop offset="0%" style="stop-color:#60a5fa;stop-opacity:1" /><stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />`;
        }
        svg += `</linearGradient></defs>`;
        
        svg += `<rect x="${startX}" y="${taskY}" width="${taskWidth}" height="${TASK_HEIGHT}" fill="url(#${gradientId})" stroke="${isCritical ? '#b91c1c' : '#1d4ed8'}" stroke-width="1"/>`;
        
        if (taskWidth > 60) {
          const textX = startX + taskWidth / 2;
          svg += `<text x="${textX}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${task.duration}д</text>`;
        }

       
        if (isCritical && showCriticalPath) {
          svg += `<circle cx="${startX - 10}" cy="${taskY + TASK_HEIGHT / 2}" r="5" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>`;
          svg += `<text x="${startX - 10}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="8" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">!</text>`;
        }

    
        if (showTimeReserves && task.totalFloat !== undefined && task.totalFloat > 0) {
          const floatStartX = startX + taskWidth;
          const floatWidth = task.totalFloat * DAY_WIDTH * scale;
          svg += `<rect x="${floatStartX}" y="${taskY}" width="${floatWidth}" height="${TASK_HEIGHT}" fill="rgba(147, 197, 253, 0.6)" stroke="#60a5fa" stroke-width="1"/>`;
          if (floatWidth > 20) {
            svg += `<text x="${floatStartX + floatWidth / 2}" y="${taskY + TASK_HEIGHT / 2}" font-family="Arial" font-size="10" fill="#1e40af" text-anchor="middle" dominant-baseline="middle">Резерв: ${task.totalFloat}д</text>`;
          }
        }
      }
      
     
      svg += `<line x1="0" y1="${y + ROW_HEIGHT}" x2="${chartWidth}" y2="${y + ROW_HEIGHT}" stroke="#e5e7eb" stroke-width="1"/>`;
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!tasks || tasks.length === 0) {
      alert('Нет данных для экспорта в CSV.');
      return;
    }

    const headers = [
      'ID',
      'Название',
      'Длительность',
      'Трудоемкость',
      'Исполнители',
      'Предшественники',
      'Раннее начало',
      'Раннее окончание',
      'Позднее начало',
      'Позднее окончание',
      'Общий резерв',
      'Свободный резерв',
      'Критический путь'
    ];

    const csvRows = [
      headers.join(';')
    ];

    tasks.forEach(task => {
      const row = [
        task.id,
        task.name,
        task.duration,
        task.laborIntensity,
        task.numberOfPerformers,
        task.predecessors.join(', '),
        task.earlyStart,
        task.earlyFinish,
        task.lateStart,
        task.lateFinish,
        task.totalFloat,
        task.freeFloat,
        task.isCritical ? 'Да' : 'Нет'
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gantt_chart_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev * 1.1, 5));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev * 0.9, 0.2));
  };

  const resetZoom = () => {
    setScale(1);
    setScrollOffset({ x: 0, y: 0 });
  };
	    const ChartRenderer = ({ isDialog = false }) => (
	    <div className="w-full h-full flex flex-col bg-white">
	      <div
	        ref={containerRef}
	        className={`flex-grow w-full h-full overflow-auto ${isDialog ? '' : 'rounded-lg border'}`}
	        style={{ cursor: isPanning ? 'grabbing' : 'grab', height: isDialog ? '100%' : '600px' }}
	      >
	        <canvas ref={canvasRef} />
	      </div>
	      {!isDialog && (
        <div className="p-2 bg-gray-50 border-t text-xs text-gray-600 flex justify-between items-center">
          <div>💡 Ctrl + колесо мыши для масштаба, ЛКМ для перемещения</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><div className="w-4 h-3 bg-blue-500 rounded-sm"></div><span>Обычные</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-3 bg-red-500 rounded-sm"></div><span>Критические</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-3 bg-blue-200 rounded-sm"></div><span>Резервы</span></div>
          </div>
        </div>
      )}
    </div>
  );
	  return (
	  <div id="gantt-chart-container" className={`space-y-4 ${isFullScreen ? 'hidden' : ''}`}>
      <div className="flex justify-between items-center">
        <CardTitle>Диаграмма Ганта</CardTitle>
        <div className="flex items-center space-x-2">
              <Button onClick={() => setIsFullScreen(true)} size="sm" variant="outline">
            <Maximize className="h-4 w-4 mr-2" />
            Во весь экран
          </Button>
          <Button onClick={resetZoom} size="sm" variant="outline" className="hover:bg-gray-50">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button onClick={zoomIn} size="sm" variant="outline" className="hover:bg-gray-50">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={zoomOut} size="sm" variant="outline" className="hover:bg-gray-50">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="border-l border-gray-200 mx-2"></div>
          <Button onClick={exportToPNG} size="sm" variant="outline" className="hover:bg-blue-50">
            <Download className="h-4 w-4 mr-2" />
            PNG
          </Button>
          <Button onClick={exportToSVG} size="sm" variant="outline" className="hover:bg-blue-50">
            <Download className="h-4 w-4 mr-2" />
            SVG
          </Button>
          <Button onClick={exportToCSV} size="sm" variant="outline" className="hover:bg-green-50">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>
     
      <Card className="border-gray-200">
  <CardContent className="p-4">
    <div className="flex flex-wrap gap-4 items-center justify-between">

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant={showCriticalPath ? "default" : "outline"}
          onClick={() => setShowCriticalPath(!showCriticalPath)}
          className="transition-all duration-200"
        >
          {showCriticalPath ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
	          Критический путь
	        </Button>
	        
	        <Button
	          size="sm"
	          variant={showTimeScale ? "default" : "outline"}
	          onClick={() => setShowTimeScale(!showTimeScale)}
	          className="transition-all duration-200"
	        >
	          {showTimeScale ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
	          Временная шкала
	        </Button>
	        
	        <Button
	          size="sm"
	          variant={showResources ? "default" : "outline"}
	          onClick={() => setShowResources(!showResources)}
	          className="transition-all duration-200"
	        >
	          {showResources ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
	          Ресурсы
	        </Button>
	        
	        <Button
	          size="sm"
	          variant={showTimeReserves ? "default" : "outline"}
	          onClick={() => setShowTimeReserves(!showTimeReserves)}
	          className="transition-all duration-200"
	        >
	          {showTimeReserves ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
	          Резервы
	        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Move className="h-4 w-4" />
        <span>Масштаб: {(scale * 100).toFixed(0)}%</span>
        {isPanning && <Badge variant="secondary">Перемещение</Badge>}
      </div>
  
      <div className="flex items-center gap-3">
        <Button onClick={onUndo} size="sm" variant="outline" disabled={!canUndo}>
          <Undo2 className="h-4 w-4 mr-2" />
          Шаг назад
        </Button>
        <Button onClick={onReset} size="sm" variant="destructive" disabled={Object.keys(userOverrides || {}).length === 0}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Сбросить
        </Button>
      </div>

    </div>
  </CardContent>
</Card>
     
	      {results && (
	        <Alert className="border-green-200 bg-green-50">
	          <CheckCircle className="h-4 w-4 text-green-600" />
	          <AlertDescription className="text-green-800">
	            <div className="flex flex-wrap gap-6">
	              <div>
	                <strong>Длительность проекта:</strong> {projectDuration?.toFixed(1)} дней
	              </div>
	              {criticalPath.length > 0 && (
	                <div>
	                  <strong>Критический путь:</strong> {criticalPath.join(' → ')}
	                </div>
	              )}
	              <div>
	                <strong>Количество задач:</strong> {tasks.length}
	              </div>
	            </div>
	          </AlertDescription>
	        </Alert>
	      )}
	      
	      <Card className="w-full border-gray-200 shadow-lg">
	        <CardContent className="p-0">
	          <div 
	            ref={containerRef}
	            className="w-full overflow-hidden border rounded-lg"
	            style={{ 
	              height: '600px',
	              cursor: isPanning ? 'grabbing' : 'grab'
	            }}
	          >
	            <canvas
	              ref={canvasRef}
	              className="block"
	              style={{ 
	                minWidth: '100%',
	                minHeight: '100%'
	              }}
	            />      
	          </div>
	          <div className="p-3 bg-gray-50 border-t text-xs text-gray-600 flex justify-between items-center">
	            <div>
	              💡 Используйте Ctrl + колесико мыши для масштабирования, левую кнопку мыши для перемещения
	            </div>
	            <div className="flex items-center gap-4">
	              <div className="flex items-center gap-2">
	                <div className="w-4 h-3 bg-blue-500 rounded"></div>
	                <span>Обычные работы</span>
	              </div>
	              <div className="flex items-center gap-2">
	                <div className="w-4 h-3 bg-red-500 rounded"></div>
	                <span>Критический путь</span>
	              </div>
	              <div className="flex items-center gap-2"> 
	                <div className="w-4 h-3 bg-blue-300 rounded"></div>
	                <span>Резервы времени</span>
	              </div>
	            </div>
	          </div>
	        </CardContent>
	      </Card>

	    {isFullScreen && (
	      <Portal>
	        <div className="fixed inset-0 z-50 bg-white flex flex-col">
	          <div className="flex justify-between items-center p-4 border-b">
	            <h2 className="text-xl font-bold">Диаграмма Ганта (Во весь экран)</h2>
	            <div className="flex items-center space-x-2">
	              <Button onClick={resetZoom} size="sm" variant="outline" className="hover:bg-gray-50">
	                <RotateCcw className="h-4 w-4" />
	              </Button>
	              <Button onClick={zoomIn} size="sm" variant="outline" className="hover:bg-gray-50">
	                <ZoomIn className="h-4 w-4" />
	              </Button>
	              <Button onClick={zoomOut} size="sm" variant="outline" className="hover:bg-gray-50">
	                <ZoomOut className="h-4 w-4" />
	              </Button>
	              <div className="border-l border-gray-200 mx-2"></div>
	              <Button onClick={() => setIsFullScreen(false)} size="sm" variant="destructive">
	                <X className="h-4 w-4 mr-2" />
	                Закрыть
	              </Button>
	            </div>
	          </div>
		          <div className="flex-grow w-full h-full p-4">
		            <div 
		              ref={containerRef}
		              className="w-full h-full overflow-hidden border rounded-lg"
		              style={{ 
		                cursor: isPanning ? 'grabbing' : 'grab'
		              }}
		            >
		              <canvas
		                ref={canvasRef}
		                className="block"
		                style={{ 
		                  minWidth: '100%',
		                  minHeight: '100%'
		                }}
		              />      
		            </div>
		          </div>
	        </div>
	      </Portal>
	    )}
       </div>
	  );
   
});
export default GanttChart;