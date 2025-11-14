import dagre from 'dagre';
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Network,
  Info,
  Eye,
  EyeOff,
  Palette,
  Maximize,
} from 'lucide-react';


const wrapText = (ctx, text, maxLineWidth) => {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let currentLine = words[0] || '';
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    if (ctx.measureText(testLine).width > maxLineWidth && i > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
};

const NetworkDiagram = forwardRef(({ results, onRenderModeChange, isFullScreen, onToggleFullScreen }, ref) => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);
  const [showTimes, setShowTimes] = useState(true);
  const [showDummies, setShowDummies] = useState(true); 
  const [renderMode, setRenderMode] = useState('aoa');
  const [colorScheme, setColorScheme] = useState('modern');
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (onRenderModeChange) {
      onRenderModeChange(renderMode);
    }
  }, [renderMode, onRenderModeChange]);

  const colorSchemes = {
    modern: { background: '#f8fafc', grid: '#e2e8f0', criticalNode: '#ef4444', normalNode: '#3b82f6', criticalEdge: '#dc2626', normalEdge: '#64748b', text: '#1e293b', nodeText: '#ffffff', shadow: 'rgba(0,0,0,0.2)' },
    classic: { background: '#ffffff', grid: '#d1d5db', criticalNode: '#dc2626', normalNode: '#2563eb', criticalEdge: '#991b1b', normalEdge: '#374151', text: '#111827', nodeText: '#ffffff', shadow: 'rgba(0,0,0,0.2)' },
    dark: { background: '#0f172a', grid: '#334155', criticalNode: '#f87171', normalNode: '#60a5fa', criticalEdge: '#ef4444', normalEdge: '#94a3b8', text: '#f1f5f9', nodeText: '#ffffff', shadow: 'rgba(255,255,255,0.1)' }
  };
  const colors = colorSchemes[colorScheme];

  useEffect(() => {
    if (!results || !results.tasks || results.tasks.length === 0) {
      setLayout(null);
      return;
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: renderMode === 'aon' ? 'TB' : 'LR',
      nodesep: renderMode === 'aon' ? 50 : 5, 
      ranksep: renderMode === 'aon' ? 30 : 40,
      marginx: 50,
      marginy: 50,
      ranker: renderMode === 'aon' ? 'network-simplex' : 'longest-path', 
    });
    
    g.setDefaultEdgeLabel(() => ({}));

    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;

    if (renderMode === 'aon') {
      const aonNodes = results.tasks.filter(t => !t.isDummy);
   
      aonNodes.forEach(task => {
        ctx.font = 'bold 11px Arial';
        const nameLines = wrapText(ctx, task.name || task.id, 140);
        const nodeWidth = 160;
        const nodeHeight = 20 + nameLines.length * 14 + 20;
        g.setNode(task.id, {
          label: task.name,
          width: nodeWidth,
          height: nodeHeight,
          isCritical: task.isCritical,
          task: task,
          rank: 'main_row',
          
        });
      });

      aonNodes.forEach(nodeTask => {
        aonNodes.forEach(succTask => {
          if(nodeTask.id.split('-')[1] === succTask.id.split('-')[0] ) {
            console.log(nodeTask);
            g.setEdge(nodeTask.id, succTask.id, 
                {
                    isCritical: nodeTask.isCritical && succTask.isCritical,
                    isDummy: nodeTask.duration == 0 || succTask.duration == 0,
                    width: 10,
                    height: 10,
                    labelpos: 'c',
                    labeloffset: 15,
                }

            );
          }
        });
      });
        

    } else {
      const nodeIds = new Set();
      results.tasks.forEach(task => {
        const [from, to] = task.id.split('-');
        nodeIds.add(from);
        nodeIds.add(to);
      });

      const criticalPathEvents = new Set();
      results.tasks.forEach(task => {
        if (task.isCritical && !task.isDummy) {
          const [from, to] = task.id.split('-');
          criticalPathEvents.add(from);
          criticalPathEvents.add(to);
        }
      });

      nodeIds.forEach(nodeId => {
        g.setNode(nodeId, {
          label: nodeId,
          width: 60,
          height: 110,
          isCritical: criticalPathEvents.has(nodeId),
          earlyTime: results.earlyEventTime?.get(nodeId) ?? 0,
          lateTime: results.lateEventTime?.get(nodeId) ?? 0,
        });
      });

      results.tasks.forEach(task => {
        const [from, to] = task.id.split('-');
        ctx.font = '11px Arial';
        const labelText = task.isDummy ? '' : `${task.name || task.id} (${task.duration}д)`;
        const labelWidth = ctx.measureText(labelText).width + 20;

        g.setEdge(from, to, {
          task: task,
          isCritical: task.isCritical,
          isDummy: task.isDummy || task.duration === 0,
          width: labelWidth,
          height: 30,
          labelpos: 'c',
          labeloffset: 15,
        });
      });
    }

    dagre.layout(g);
    setLayout(g);
  }, [results, renderMode]);


  useEffect(() => {
    drawNetwork();
  }, [layout, scale, offset, showLabels, showTimes, colorScheme, showDummies]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - offset.x) / scale;
        const worldY = (mouseY - offset.y) / scale;
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * scaleFactor, 0.1), 5);
        const newOffsetX = mouseX - worldX * newScale;
        const newOffsetY = mouseY - worldY * newScale;
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
    };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [scale, offset]);

  const drawNetwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawGrid(ctx, rect.width, rect.height);

    if (!layout) {
      drawEmptyState(ctx, rect.width, rect.height);
      return;
    }

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    layout.edges().forEach(edgeInfo => {
      const edge = layout.edge(edgeInfo);
      if (renderMode === 'aon') {
        drawAoaEdge(ctx, edge);
      } else {
        drawAoaEdge(ctx, edge);
      }
    });

    layout.nodes().forEach(nodeId => {
      const node = layout.node(nodeId);
      if (renderMode === 'aon') {
        drawAonNode(ctx, node);
      } else {
        drawAoaNode(ctx, node, nodeId);
      }
    });

    ctx.restore();
    drawLegend(ctx, rect.width, rect.height);
  };

  const drawAoaNode = (ctx, node, nodeId) => {
    const radius = 20; 
    const { x, y, isCritical, earlyTime, lateTime } = node;
    
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
    ctx.fillStyle = isCritical ? colors.criticalEdge : colors.normalEdge;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isCritical ? colors.criticalNode : colors.normalNode;
    ctx.fill();
    
    ctx.restore();

    ctx.fillStyle = colors.nodeText;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nodeId, x, y);

    if (showTimes) {
      ctx.font = '10px Arial';
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.fillText(`РН: ${earlyTime}`, x, y - radius - 12);
      ctx.fillText(`ПН: ${lateTime}`, x, y + radius + 15);
    }
  };

  const drawCurvedEdge = (ctx, points, isDashed = false) => {
      if (points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
      }
      
      ctx.stroke();
  }

   const drawAoaEdge = (ctx, edge) => {
    const { task, isCritical, isDummy, points } = edge;
    if (isDummy && !showDummies) return;
    
    ctx.save();
    ctx.lineWidth = isCritical ? 3 : 2;
    
    if (isDummy) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = colors.normalEdge;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = isCritical ? colors.criticalEdge : colors.normalEdge;
    }
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    const p1 = points[points.length - 2] || points[0];
    const p2 = points[points.length - 1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const arrowLength = 10;
    
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - arrowLength * Math.cos(angle - Math.PI / 6), p2.y - arrowLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(p2.x - arrowLength * Math.cos(angle + Math.PI / 6), p2.y - arrowLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (showLabels && task && !isDummy) {
      const midPoint = edge.points[Math.floor(edge.points.length / 2)];
      const text = `${task.name || task.id} (${task.duration}д)`;
      
      ctx.font = '11px Arial';
      const textWidth = ctx.measureText(text).width;
      
      ctx.save();
      ctx.translate(midPoint.x, midPoint.y);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(-textWidth / 2 - 4, -20, textWidth + 8, 18); 
      
      ctx.fillStyle = isCritical ? colors.criticalEdge : colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, -11); 
      
      ctx.restore();
    }
  };

   const drawAonNode = (ctx, node) => {
    const { x, y, width, height, isCritical, task } = node;
    const r = 8;
    const padding = 10;
    
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    
    ctx.beginPath();
    ctx.moveTo(x - width/2 + r, y - height/2);
    ctx.arcTo(x + width/2, y - height/2, x + width/2, y + height/2, r);
    ctx.arcTo(x + width/2, y + height/2, x - width/2, y + height/2, r);
    ctx.arcTo(x - width/2, y + height/2, x - width/2, y - height/2, r);
    ctx.arcTo(x - width/2, y - height/2, x + width/2, y - height/2, r);
    ctx.closePath();
    
    ctx.fillStyle = isCritical ? colors.criticalNode : colors.normalNode;
    ctx.fill();
    ctx.strokeStyle = isCritical ? colors.criticalEdge : colors.normalEdge;
    ctx.lineWidth = isCritical ? 3 : 1.5;
    ctx.stroke();
    ctx.restore();

    if (showLabels) {
        ctx.fillStyle = colors.nodeText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.font = 'bold 12px Arial';
        const lines = wrapText(ctx, task.name, width - 2 * padding);
        const lineHeight = 14;
        const totalTitleHeight = lines.length * lineHeight;
        let startY = y - totalTitleHeight / 2 + lineHeight / 2;
        
        if (showTimes) {
            startY -= 10;
        }

        lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
        
        ctx.font = '10px Arial';
        ctx.fillText(`(${task.duration} дн.)`, x, startY + totalTitleHeight);
    }
    if (showTimes) {
        ctx.fillStyle = colors.text;
        ctx.font = '10px Arial';
        
        ctx.textAlign = 'left';
        ctx.fillText(`РН: ${task.earlyStart.toFixed(1)}`, x - width/2 + 5, y - height/2 - 5);
        ctx.textAlign = 'right';
        ctx.fillText(`РО: ${task.earlyFinish.toFixed(1)}`, x + width/2 - 5, y - height/2 - 5);

        ctx.textAlign = 'left';
        ctx.fillText(`ПН: ${task.lateStart.toFixed(1)}`, x - width/2 + 5, y + height/2 + 15);
        ctx.textAlign = 'right';
        ctx.fillText(`ПО: ${task.lateFinish.toFixed(1)}`, x + width/2 - 5, y + height/2 + 15);
    }
  };

  const drawAonEdge = (ctx, edge) => {
    const { points, isCritical } = edge;
    ctx.save();
    ctx.lineWidth = isCritical ? 3 : 1.5;
    ctx.strokeStyle = isCritical ? colors.criticalEdge : colors.normalEdge;
    
    drawCurvedEdge(ctx, points);

    const p1 = points[points.length - 2] || points[0];
    const p2 = points[points.length - 1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    drawArrowhead(ctx, p2.x, p2.y, angle, isCritical ? colors.criticalEdge : colors.normalEdge);
    
    ctx.restore();
};

  const drawGrid = (ctx, width, height) => {
    const gridSize = 20 * scale;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    for (let x = (offset.x % gridSize); x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = (offset.y % gridSize); y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const drawLegend = (ctx, width, height) => {
    const legendX = width - 230;
    const legendY = 20;
    const legendWidth = 210;
    let items;
    
    if (renderMode === 'aon') {
      items = [
        { color: colors.criticalNode, text: 'Критический узел', type: 'node', stroke: colors.criticalEdge },
        { color: colors.normalNode,   text: 'Обычный узел',      type: 'node', stroke: colors.normalEdge },
        { color: colors.criticalEdge, text: 'Критический путь', type: 'edge' },
      ];
    } else {
      items = [
        { color: colors.criticalNode, text: 'Критическое событие', type: 'node', stroke: colors.criticalEdge },
        { color: colors.normalNode,   text: 'Обычное событие',      type: 'node', stroke: colors.normalEdge },
        { color: colors.criticalEdge, text: 'Критическая работа',type: 'edge' },
        { color: colors.normalEdge,   text: 'Обычная работа',    type: 'edge' },
      ];
      if (showDummies) {
        items.push({ color: colors.normalEdge, text: 'Фиктивная работа (пунктир)', type: 'dummy' });
      }
    }
    const legendHeight = 30 + items.length * 22 + 10;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = colors.background; 
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight); 
    ctx.restore();
    
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Легенда', legendX + 15, legendY + 22);
    
    items.forEach((item, index) => {
      const y = legendY + 50 + index * 22;
      if (item.type === 'node') {
        ctx.beginPath();
        ctx.arc(legendX + 20, y, 7, 0, 2 * Math.PI);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.type === 'dummy' ? 2 : 3;
        if (item.type === 'dummy') ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(legendX + 10, y); ctx.lineTo(legendX + 30, y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = colors.text;
      ctx.font = '12px Arial';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text, legendX + 45, y);
    });
  };

  const drawEmptyState = (ctx, width, height) => {
    ctx.fillStyle = colors.text;
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Выполните расчет для построения сетевого графика', width / 2, height / 2);
  };

  const handleMouseDown = (e) => { setIsDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); };
  const handleMouseMove = (e) => { if (isDragging) { setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); } };
  const handleMouseUp = () => { setIsDragging(false); };
  const resetView = () => { setScale(1); setOffset({ x: 50, y: 50 }); };

  const getDiagramAsBase64 = (exportScale = 2, bgColor = '#FFFFFF') => {
    if (!layout) return null;
    try {
      const g = layout;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      g.nodes().forEach(id => {
        const node = g.node(id);
        const nodePadding = renderMode === 'aoa' ? 30 : 0; 
        minX = Math.min(minX, node.x - node.width / 2 - nodePadding);
        minY = Math.min(minY, node.y - node.height / 2 - nodePadding);
        maxX = Math.max(maxX, node.x + node.width / 2 + nodePadding);
        maxY = Math.max(maxY, node.y + node.height / 2 + nodePadding);
      });
      g.edges().forEach(id => {
        const edge = g.edge(id);
        edge.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      });

      const padding = 50;
      const width = maxX - minX;
      const height = maxY - minY;
      const fullWidth = width + padding * 2;
      const fullHeight = height + padding * 2;
      
      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d');
      offscreenCanvas.width = fullWidth * exportScale;
      offscreenCanvas.height = fullHeight * exportScale;
      ctx.scale(exportScale, exportScale);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, fullWidth, fullHeight);
      ctx.save();
      
      ctx.translate(padding - minX, padding - minY); 
      
      g.edges().forEach(e => renderMode === 'aon' ? drawAonEdge(ctx, g.edge(e)) : drawAoaEdge(ctx, g.edge(e)));
      g.nodes().forEach(n => renderMode === 'aon' ? drawAonNode(ctx, g.node(n)) : drawAoaNode(ctx, g.node(n), n));
      
      ctx.restore();
      return offscreenCanvas.toDataURL('image/png', 1.0);
    } catch (e) {
      console.error("Ошибка при создании base64:", e);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    getAsBase64: () => getDiagramAsBase64(2, '#FFFFFF'),
    getCurrentRenderMode: () => renderMode,
  }));

  const exportDiagram = () => {
    const base64 = getDiagramAsBase64(1.5, colors.background);
    if (base64) {
      const link = document.createElement('a');
      link.download = `network_diagram_${new Date().toISOString().split('T')[0]}.png`;
      link.href = base64;
      link.click();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Network className="h-5 w-5" />Сетевой график</h3>
          <p className="text-sm text-muted-foreground">Интерактивная диаграмма сетевого планирования</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setScale(prev => prev * 1.2)} size="sm" variant="outline"><ZoomIn className="h-4 w-4" /></Button>
          <Button onClick={() => setScale(prev => prev * 0.8)} size="sm" variant="outline"><ZoomOut className="h-4 w-4" /></Button>
          <Button onClick={resetView} size="sm" variant="outline"><RotateCcw className="h-4 w-4" /></Button>
          <Button onClick={exportDiagram} size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
          <Button onClick={onToggleFullScreen} size="sm" variant="outline"><Maximize className="h-4 w-4" /></Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Button size="sm" variant={showLabels ? "default" : "outline"} onClick={() => setShowLabels(!showLabels)}><Eye className="h-4 w-4 mr-1" />Подписи</Button>
              {renderMode === 'aoa' && <Button size="sm" variant={showTimes ? "default" : "outline"} onClick={() => setShowTimes(!showTimes)}><Eye className="h-4 w-4 mr-1" />Времена</Button>}
              {renderMode === 'aoa' && <Button size="sm" variant={showDummies ? "default" : "outline"} onClick={() => setShowDummies(!showDummies)}><Eye className="h-4 w-4 mr-1" />Фиктивные</Button>}
              {renderMode === 'aon' && <Button size="sm" variant={showTimes ? "default" : "outline"} onClick={() => setShowTimes(!showTimes)}><Eye className="h-4 w-4 mr-1" />Сроки</Button>}
            </div>
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <select value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} className="px-2 py-1 border rounded text-sm">
                <option value="modern">Современная</option>
                <option value="classic">Классическая</option>
                <option value="dark">Темная</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Режим:</span>
              <select value={renderMode} onChange={(e) => setRenderMode(e.target.value)} className="px-2 py-1 border rounded text-sm">
                <option value="aoa">AOA (работа-ребро)</option>
                <option value="aon">AON (работа-узел)</option>
              </select>
            </div>
            <div className="text-sm text-muted-foreground">Масштаб: {(scale * 100).toFixed(0)}%</div>
          </div>
        </CardContent>
      </Card>
      {results && results.criticalPath && (
        <Alert className="flex flex-col items-start">
          <div className="flex items-center mb-2">
            <Info className="h-4 w-4 mr-2" />
            <AlertDescription><strong>Критический путь:</strong> {(results.criticalPath || []).join(' → ')}</AlertDescription>
          </div>
          {results.projectDuration && (
            <p className="text-sm font-semibold ml-6">Длительность проекта: {results.projectDuration.toFixed(2)} дней</p>
          )}
        </Alert>
      )}
      <Card>
        <CardContent className="p-0">
          <canvas ref={canvasRef} className={`w-full ${isFullScreen ? 'h-screen' : 'h-[600px]'} cursor-grab active:cursor-grabbing border-0`}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
        </CardContent>
      </Card>
      {results && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="text-center p-4">
            <p className="text-2xl font-bold text-blue-600">{results.tasks.length}</p>
            <p className="text-sm text-muted-foreground">Всего работ</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold text-red-600">{results.tasks.filter(t => t.isCritical).length}</p>
            <p className="text-sm text-muted-foreground">Критических работ</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-2xl font-bold text-green-600">{results.projectDuration ? results.projectDuration.toFixed(1) : 'N/A'}</p>
            <p className="text-sm text-muted-foreground">Дней проекта</p>
          </Card>
        </div>
      )}
    </div>
  );
});

export default NetworkDiagram;
