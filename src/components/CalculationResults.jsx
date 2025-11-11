
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calculator, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Users,
  Target,
  TrendingUp
} from 'lucide-react';
import ResourceManagement from './ResourceManagement';

const formatNumberForCSV = (num) => {
  const number = Number(num);
  if (!Number.isFinite(number)) {
    return '0,00';
  }
  return String(Number(number.toFixed(2))).replace('.', ',');
};

const CalculationResults = ({ results, project }) => {
  const [hideDummies, setHideDummies] = useState(false);

  if (!results || !results.tasks || results.tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Результаты расчетов
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Calculator className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            Добавьте задачи и нажмите "Рассчитать" для получения результатов
          </p>
        </CardContent>
      </Card>
    );
  }

 const exportToCSV = () => {
    const headers = [
      'Код работы',
      'Наименование',
      'Продолжительность (ч)',
      'Трудоемкость н/ч',
      'Кол-во исполнителей',
      'Ранний срок предш. события (ч)',
      'Раннее окончание работы (ч)',
      'Ранний срок послед. события (ч)',
      'Поздний срок предш. события (ч)',
      'Позднее начало работы (ч)',
      'Поздний срок послед. события (ч)',
      'Резерв времени послед. события (ч)',
      'Частный резерв работы (ч)',
      'Полный резерв работы (ч)',
      'Принадлежность к крит. пути'
    ];

    const csvContent = [
      headers.join(';'),
      ...visibleTasks.map(task =>  {


        const row = [
          `"=""${task.id}"""`,
          `"${task.name}"`,
          formatNumberForCSV(task.durationHours),
          formatNumberForCSV(task.laborIntensity),
          task.numberOfPerformers,
          formatNumberForCSV(task.earlyEventTimeI),
          formatNumberForCSV(task.earlyFinish),
          formatNumberForCSV(task.earlyEventTimeJ),
          formatNumberForCSV(task.lateEventTimeI),
          formatNumberForCSV(task.lateStart),
          formatNumberForCSV(task.lateFinish),
          formatNumberForCSV(task.eventFloatJ),
          formatNumberForCSV(task.freeFloat),
          formatNumberForCSV(task.totalFloat),
          task.isCritical ? 'Да' : 'Нет'
        ];
        return row.join(';');
      })
    ].join('\n');

    const dataBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `spu_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
      };

  const criticalTasks = results.tasks.filter(t => !t.isDummy && t.isCritical);  
  const nonCriticalTasks = results.tasks.filter(t => !t.isDummy && !t.isCritical);
  const allTasks = results?.tasks || [];
  const visibleTasks = hideDummies 
    ? allTasks.filter(t => t.isDummy !== true && t.duration > 0) 
    : allTasks;

  const parseFromTo = (task) => {
    const parts = String(task.id).split('-');
    const from = Number(parts[0]);
    const to = Number(parts[1]);
    return { from, to };
  };

  const criticalTaskPath = (() => {
    const evPath = Array.isArray(results.criticalPath) ? results.criticalPath : [];
    if (evPath.length < 2) return [];
    const tasks = results.tasks || [];
    const includeDummies = !hideDummies;
    const pathTasks = [];
    for (let i = 0; i < evPath.length - 1; i++) {
      const a = Number(evPath[i]);
      const b = Number(evPath[i + 1]);
      const t = tasks.find(tt => {
        const { from, to } = parseFromTo(tt);
        return from === a && to === b && tt.isCritical === true && (includeDummies || tt.isDummy !== true);
      });
      if (t) pathTasks.push(t);
    }
    return pathTasks;
  })();

   const renderCell = (value, style = {}) => (
  <td style={style} className="border border-gray-300 px-3 py-2 text-center">
    {formatNumberForCSV(value)}
  </td>
);

  return (
    <div className="space-y-6">
    
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Длительность проекта</p>
                <p className="text-2xl font-bold">{results.projectDuration?.toFixed(2) || 0} дн.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Всего работ</p>
                <p className="text-2xl font-bold">{results.tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Критических работ</p>
                <p className="text-2xl font-bold text-red-600">{criticalTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Общая трудоемкость</p>
                <p className="text-2xl font-bold">
                  {results.tasks.reduce((sum, task) => sum + (task.laborIntensity || 0), 0).toFixed(0)} н-ч
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {results.criticalPath && results.criticalPath.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Критический путь
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticalTaskPath.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {criticalTaskPath.map((t, idx) => {
                    const labelId = hideDummies ? (t.sourceTaskId || t.id) : t.id;
                    return (
                      <React.Fragment key={t.id}>
                        <Badge variant="destructive" className="text-sm">
                          {labelId}
                        </Badge>
                        {idx < criticalTaskPath.length - 1 && (
                          <span className="text-muted-foreground text-lg">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground mt-2">
              Длительность критического пути: {results.projectDuration?.toFixed(2) || 0} дней
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Таблица 6.1.2</TabsTrigger>
          <TabsTrigger value="analysis">Анализ работ</TabsTrigger>
          
        </TabsList>

       
        <TabsContent value="table">
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Таблица 6.1.2 - Параметры сетевого графика
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="text-sm flex items-center gap-2 select-none">
                      <input
                        type="checkbox"
                        checked={hideDummies}
                        onChange={(e) => setHideDummies(e.target.checked)}
                      />
                      Скрыть фиктивные
                    </label>
                    <Button onClick={exportToCSV} size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Экспорт в CSV
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th style={{ width: '100px' }} className="border border-gray-300 p-2 text-left font-medium">Код работы</th>
                      <th style={{ minWidth: '100px' }} className="border border-gray-300 p-2 text-left font-medium">Наименование</th>
                      <th style={{ width: '110px' }} className="border border-gray-300 p-2 text-center font-medium">Продолжительность (ч) (t<sub>ij</sub>)</th>
                      <th style={{ width: '110px' }} className="border border-gray-300 p-2 text-center font-medium">Трудоемкость н/ч (Q<sub>ij</sub>)</th>
                      <th style={{ width: '100px' }} className="border border-gray-300 p-2 text-center font-medium">Кол-во исполнителей (q<sub>ij</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Ранний срок предш. события (T<sup>p</sup><sub>i</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Раннее окончание работы (t<sup>po</sup><sub>ij</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Ранний срок послед. события (T<sup>p</sup><sub>j</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Поздний срок предш. события (T<sup>п</sup><sub>i</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Позднее начало работы (t<sup>пн</sup><sub>ij</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Поздний срок послед. события (T<sup>п</sup><sub>j</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Резерв времени послед. события (R<sub>j</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Частный резерв работы (R<sup>ч</sup><sub>ij</sub>)</th>
                      <th style={{ width: '120px' }} className="border border-gray-300 p-2 text-center font-medium">Полный резерв работы (R<sup>п</sup><sub>ij</sub>)</th>
                      <th style={{ width: '130px' }} className="border border-gray-300 p-2 text-center font-medium">Принадлежность к крит. пути</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task, index) => {
                      const isCriticalVisual = !task.isDummy && task.isCritical;
                      const rowClass = isCriticalVisual ? 'bg-red-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50');
                      
                      return (
                       <tr key={task.id} className={`${rowClass} hover:bg-blue-50`}>
                        <td style={{ width: '100px' }} className="border border-gray-300 px-3 py-2 font-medium">{task.id}</td>
                        <td style={{ minWidth: '200px', wordBreak: 'break-word' }} className="border border-gray-300 px-3 py-2">{task.name}</td>
                        {renderCell(task.durationHours, { width: '130px' })}
                        {renderCell(task.laborIntensity, { width: '130px' })}
                        {renderCell(task.numberOfPerformers, { width: '120px' })}
                        {renderCell(task.earlyEventTimeI, { width: '120px' })}
                        {renderCell(task.earlyFinish, { width: '120px' })}
                        {renderCell(task.earlyEventTimeJ, { width: '120px' })}
                        {renderCell(task.lateEventTimeI, { width: '120px' })}
                        {renderCell(task.lateStart, { width: '120px' })}
                        {renderCell(task.lateFinish, { width: '120px' })}
                        {renderCell(task.eventFloatJ, { width: '120px' })}
                        {renderCell(task.freeFloat, { width: '120px' })}
                        {renderCell(task.totalFloat, { width: '120px' })}
                        <td style={{ width: '130px' }} className="border border-gray-300 px-3 py-2 text-center">
                          {isCriticalVisual ? <Badge variant="destructive">Да</Badge> : <Badge variant="outline">Нет</Badge>}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              

              <div className="mt-4 text-sm text-muted-foreground">
                <p><strong>Обозначения:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>К - работа принадлежит критическому пути</li>
                  <li>Полный резерв времени - максимальная задержка без влияния на срок проекта</li>
                  <li>Частный резерв времени - задержка без влияния на раннее начало последующих работ</li>
                  <li>Критические работы выделены красным фоном</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        
        <TabsContent value="analysis">
          <div className="space-y-4">
           
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Критические работы ({criticalTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {criticalTasks.length > 0 ? (
                  <div className="space-y-3">
                    {criticalTasks.map((task) => (
                      <div key={task.id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-red-800">{task.id} - {task.name}</p>
                            <p className="text-sm text-red-600">
                              Длительность: {task.duration} дн., Исполнители: {task.numberOfPerformers} чел.
                            </p>
                          </div>
                          <Badge variant="destructive">Критическая</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Критические работы не найдены</p>
                )}
              </CardContent>
            </Card>

          
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Некритические работы ({nonCriticalTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nonCriticalTasks.length > 0 ? (
                  <div className="space-y-3">
                    {nonCriticalTasks.map((task) => (
                      <div key={task.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{task.id} - {task.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Длительность: {task.duration} дн., Резерв: {task.totalFloat?.toFixed(2) || 0} дн.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">Некритическая</Badge>
                            {task.totalFloat > 10 && (
                              <Badge variant="secondary">Большой резерв</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Некритические работы не найдены</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        
        <TabsContent value="resources">
          <ResourceManagement results={results} project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalculationResults;
