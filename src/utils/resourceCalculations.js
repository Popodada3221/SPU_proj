export function calculateDailyLoad(tasks, projectDuration) {
  if (!tasks || tasks.length === 0 || !projectDuration) {
    return [];
  }

  const tasksById = new Map(tasks.map(t => [t.id, t]));
  const dailyLoad = Array(Math.ceil(projectDuration)).fill(0);

  tasks.forEach(task => {
    if (task.isDummy || !task.numberOfPerformers) {
      return;
    }

    let actualStartDay = 0;
    if (task.predecessors && task.predecessors.length > 0) {
      const predecessorEndTimes = task.predecessors.map(predId => {
        const predecessorTask = tasksById.get(predId);
        if (!predecessorTask) return 0;
        
        const predActualStart = predecessorTask.userDefinedStart !== undefined 
          ? predecessorTask.userDefinedStart 
          : predecessorTask.earlyStart;
          
        return predActualStart + predecessorTask.duration;
      });
      actualStartDay = Math.max(0, ...predecessorEndTimes);
    } else {
      actualStartDay = task.earlyStart;
    }
    
    if (task.userDefinedStart !== undefined) {
      actualStartDay = task.userDefinedStart;
    }

    const actualEndDay = actualStartDay + task.duration;
    const startDayIndex = Math.floor(actualStartDay);
    const endDayIndex = Math.ceil(actualEndDay);

    for (let day = startDayIndex; day < endDayIndex; day++) {
      if (day >= 0 && day < dailyLoad.length) {
        dailyLoad[day] += Number(task.numberOfPerformers);
      }
    }
  });

  return dailyLoad.map((load, day) => ({ day, load }));
}
