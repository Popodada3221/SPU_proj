import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  if (Number.isFinite(number)) {
    return number.toFixed(2).replace('.', ',');
  }
  return '0,00';
};

const CalculationResults = ({ results, project }) => {
  const [selectedTask, setSelectedTask] = useState(null);
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
      'ID работы',
      'Наименование работы',
      'Продолжительность (дни)',
      'Трудоемкость (н-ч)',
      'Количество исполнителей',
      'Предшественники',
      'Раннее начало',
      'Раннее окончание',
      'Позднее начало',
      'Позднее окончание',
      'Полный резерв',
      'Частный резерв',
      'Критическая работа'
    ];

    const csvContent = [
      headers.join(';'),
      ...results.tasks.map(task => {
        const taskIdAsFormula = `="${task.id}"`;
        return [
          taskIdAsFormula,
          `"${task.name}"`,
          task.duration,
          task.laborIntensity || 0,
          task.numberOfPerformers,
          `"${(task.predecessors || []).join(', ')}"`,
          formatNumberForCSV(task.earlyStart),
          formatNumberForCSV(task.earlyFinish),
          formatNumberForCSV(task.lateStart),
          formatNumberForCSV(task.lateFinish),
          formatNumberForCSV(task.totalFloat),
          formatNumberForCSV(task.freeFloat),
          (!task.isDummy && task.isCritical) ? 'Да' : 'Нет'
        ].join(';');
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
  const visibleTasks = hideDummies ? results.tasks.filter(t => !t.isDummy) : results.tasks;

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
                {/* описание убрано по требованию */}
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
                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                        Код работы
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                        Наименование работы
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Продолжительность, дни
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Трудоемкость, н-ч
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Количество исполнителей
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Раннее начало
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Раннее окончание
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Позднее начало
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Позднее окончание
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Полный резерв времени
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Частный резерв времени
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-medium">
                        Принадлежность к критическому пути
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task, index) => {
                      const isCriticalVisual = !task.isDummy && task.isCritical;
                      const baseBg = isCriticalVisual
                        ? 'bg-red-50'
                        : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50');
                      const displayId = hideDummies ? (task.sourceTaskId || task.id) : task.id;
                      return (
                        <tr
                          key={task.id}
                          className={`${baseBg} hover:bg-blue-50 cursor-pointer`}
                          onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                        >
                          <td className="border border-gray-300 px-3 py-2 font-medium">
                            {displayId}
                            {isCriticalVisual && <Badge variant="destructive" className="ml-2 text-xs">К</Badge>}
                            {task.isDummy && <Badge variant="outline" className="ml-2 text-xs">Фиктивная</Badge>}
                          </td>
                          <td className="border border-gray-300 px-3 py-2">
                            {task.name}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.duration}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.laborIntensity ?? task.duration}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.numberOfPerformers}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.earlyStart?.toFixed(2) || '0.00'}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.earlyFinish?.toFixed(2) || task.duration?.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.lateStart?.toFixed(2) || '0.00'}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {task.lateFinish?.toFixed(2) || task.duration?.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <span className={task.totalFloat > 0.001 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                              {task.totalFloat?.toFixed(2) || '0.00'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <span className={task.freeFloat > 0.001 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                              {task.freeFloat?.toFixed(2) || '0.00'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            {isCriticalVisual ? (
                              <Badge variant="destructive">Да</Badge>
                            ) : (
                              <Badge variant="outline">Нет</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {selectedTask && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Детали работы {selectedTask}:</strong>
                    {(() => {
                      const task = results.tasks.find(t => t.id === selectedTask);
                      return task ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <p>Предшественники: {task.predecessors.length > 0 ? task.predecessors.join(', ') : 'нет'}</p>
                          <p>Резерв времени: {task.totalFloat > 0.001 ? `${task.totalFloat.toFixed(2)} дней` : 'отсутствует'}</p>
                          <p>Статус: 
                            {(() => { 
                              const isCriticalVisual = !task.isDummy && task.isCritical;
                              return (
                                <p>
                                  Статус: {task.isDummy ? 'фиктивная работа' : (isCriticalVisual ? 'критическая работа' : 'некритическая работа')}
                                </p>
                              );
                            })()}
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </AlertDescription>
                </Alert>
              )}

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
