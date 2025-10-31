/**
 * @param {Array} tasks
 * @param {number} projectDuration 
 * @returns {Array<{day: number, load: number}>} 
 */
export function calculateDailyLoad(tasks, projectDuration) {
  if (!tasks || tasks.length === 0 || !projectDuration) {
    return [];
  }

  const dailyLoad = Array.from({ length: Math.ceil(projectDuration) + 1 }, (_, i) => ({
    day: i,
    load: 0,
  }));

  tasks.forEach(task => {
    if (task.isDummy) {
      return;
    }

    const startDay = Math.floor(task.earlyStart);
    const endDay = Math.ceil(task.earlyFinish);
    const performers = task.numberOfPerformers || 0;

    for (let i = startDay; i < endDay; i++) {
      if (dailyLoad[i]) {
        dailyLoad[i].load += performers;
      }
    }
  });

  return dailyLoad;
}