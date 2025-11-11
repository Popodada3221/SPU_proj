

export class SPUTask {

  constructor(name, duration, from, to, laborIntensity = 0, numberOfPerformers = 1, qualificationId = null, efficiencyMultiplier = 1.0) {
    this.name = name;
    this.duration = Number(duration) || 0; 
    this.from = String(from);
    this.to = String(to);

    if (this.duration === 0) {
      this.laborIntensity = 0;
      this.numberOfPerformers = 0;
    } else {
      this.laborIntensity = parseFloat(laborIntensity) || this.duration;
      this.numberOfPerformers = parseInt(numberOfPerformers) || 1;
    }
    
    this.qualificationId = qualificationId;
    this.efficiencyMultiplier = parseFloat(efficiencyMultiplier) || 1.0;
    
    this.ES = 0; 
    this.EF = 0; 
    this.LS = 0; 
    this.LF = 0; 
    
    this._totalFloat = 0; 
    this._freeFloat = 0;  
  }

  get id() { return `${this.from}-${this.to}`; }
  get totalFloat() { return this._totalFloat; }
  set totalFloat(value) { this._totalFloat = value; }
  get freeFloat() { return this._freeFloat; }
  set freeFloat(value) { this._freeFloat = value; }
  get isCritical() { return Math.abs(this.totalFloat) < 0.001; }
}

export class SPUCalculation {
  constructor(tasks) {
    this.tasks = tasks;
  }

  calculateNetworkTimes(overrides = {}) {
    const allNodes = [...new Set(this.tasks.flatMap(t => [t.from, t.to]))];
    const incoming = new Map(allNodes.map(n => [n, []]));
    const outgoing = new Map(allNodes.map(n => [n, []]));
    
    this.tasks.forEach(task => {
      if (task.from && task.to) {
        outgoing.get(task.from)?.push(task);
        incoming.get(task.to)?.push(task);
      }
    });

    const sortedNodes = this.topologicalSort(allNodes, outgoing);
    
    const earlyEventTime = new Map(allNodes.map(n => [n, 0]));

    for (const node of sortedNodes) {
      const earlyTime = earlyEventTime.get(node) || 0;
      for (const task of (outgoing.get(node) || [])) {
        const override = overrides[task.id];
        task.ES = (override && override.userDefinedStart !== undefined) ? override.userDefinedStart : earlyTime;
        task.EF = task.ES + task.duration;
        earlyEventTime.set(task.to, Math.max(earlyEventTime.get(task.to) || 0, task.EF));
      }
    }

    const projectDuration = Math.max(0, ...Array.from(earlyEventTime.values()));

    const lateEventTime = new Map(allNodes.map(n => [n, projectDuration]));
    
    for (let i = sortedNodes.length - 1; i >= 0; i--) {
      const node = sortedNodes[i];
      for (const task of (incoming.get(node) || [])) {
        task.LF = lateEventTime.get(node);
        task.LS = task.LF - task.duration;
        lateEventTime.set(task.from, Math.min(lateEventTime.get(task.from) ?? Infinity, task.LS));
      }
    }

    this.tasks.forEach(task => {
      task.totalFloat = (lateEventTime.get(task.to) ?? projectDuration) - (earlyEventTime.get(task.from) ?? 0) - task.duration;
      task.freeFloat = (earlyEventTime.get(task.to) || 0) - task.EF;
    });

    return { tasks: this.tasks, projectDuration, criticalPath: this.findCriticalPath(this.tasks, earlyEventTime, lateEventTime), nodes: allNodes, earlyEventTime, lateEventTime };
  }

  topologicalSort(nodes, outgoing) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (node) => {
      if (!node) return;
      if (visiting.has(node)) throw new Error(`Обнаружен цикл в сетевом графике, затрагивающий узел: ${node}`);
      if (visited.has(node)) return;
      
      visiting.add(node);
      (outgoing.get(node) || []).forEach(task => visit(task.to));
      visiting.delete(node);
      
      visited.add(node);
      sorted.push(node);
    };

    const startNodes = nodes.filter(node => !this.tasks.some(t => String(t.to) === String(node)));
    startNodes.forEach(visit);
    nodes.forEach(node => { if (!visited.has(node)) visit(node); });

    return sorted.reverse();
  }

  findCriticalPath(tasks) {
    const criticalTasks = tasks.filter(task => task.isCritical);
    if (criticalTasks.length === 0) return [];

    const taskMap = new Map();
    criticalTasks.forEach(task => {
        if (!taskMap.has(task.from)) {
            taskMap.set(task.from, []);
        }
        taskMap.get(task.from).push(task);
    });

    const startNodes = criticalTasks
        .map(t => t.from)
        .filter(from => !criticalTasks.some(t => t.to === from));
    

    const uniqueStartNodes = [...new Set(startNodes)];
    if (uniqueStartNodes.length === 0 && criticalTasks.length > 0) {
        const earliestTask = criticalTasks.sort((a, b) => a.ES - b.ES)[0];
        uniqueStartNodes.push(earliestTask.from);
    }
    const findLongestPath = (node, visited = new Set()) => {
        if (visited.has(node)) return []; 
        visited.add(node);

        const nextTasks = taskMap.get(node) || [];
        if (nextTasks.length === 0) return [node]; 

        let longestPath = [];
        for (const task of nextTasks) {
            const path = [node, ...findLongestPath(task.to, new Set(visited))];
            if (path.length > longestPath.length) {
                longestPath = path;
            }
        }
        return longestPath;
    };

    let finalPath = [];
    for (const startNode of uniqueStartNodes) {
        const path = findLongestPath(startNode);
        if (path.length > finalPath.length) {
            finalPath = path;
        }
    }

    return finalPath;
}


  static calculateNetworkParameters(tasks, overrides = {}) {
     try {
      const spuTasks = tasks.map(t => {
        const [from, to] = t.id.split('-');
        return new SPUTask(t.name, t.duration, from, to, t.laborIntensity, t.numberOfPerformers, t.qualificationId, t.efficiencyMultiplier);
      });

      const calculation = new SPUCalculation(spuTasks);
      const result = calculation.calculateNetworkTimes(overrides);

      const calculatedTasks = result.tasks.map(spuTask => {
      const earlyEventTimeI = result.earlyEventTime.get(spuTask.from) ?? 0;
      const lateEventTimeI = result.lateEventTime.get(spuTask.from) ?? 0;
      const earlyEventTimeJ = result.earlyEventTime.get(spuTask.to) ?? 0;
      const lateEventTimeJ = result.lateEventTime.get(spuTask.to) ?? 0;
  

      return {
        id: spuTask.id,
        name: spuTask.name,
        laborIntensity: spuTask.laborIntensity, 
        numberOfPerformers: spuTask.numberOfPerformers, 
        isCritical: spuTask.isCritical, 

        duration: spuTask.duration,
        earlyStart: spuTask.ES, 
        lateStart: spuTask.LS*HOURS_PER_DAY, 
        totalFloat: spuTask.totalFloat*HOURS_PER_DAY,
        freeFloat: spuTask.freeFloat*HOURS_PER_DAY,

        durationHours: spuTask.duration * HOURS_PER_DAY,
        earlyEventTimeI: earlyEventTimeI * HOURS_PER_DAY,
        earlyFinish: spuTask.EF * HOURS_PER_DAY,
        earlyEventTimeJ: earlyEventTimeJ * HOURS_PER_DAY,
        lateEventTimeI: lateEventTimeI * HOURS_PER_DAY,
        lateStartHours: spuTask.LS*HOURS_PER_DAY, 
        lateFinishHours: spuTask.LF * HOURS_PER_DAY,
        lateFinish: spuTask.LF,
        eventFloatJ: (lateEventTimeJ - earlyEventTimeJ) * HOURS_PER_DAY,
        freeFloatHours: spuTask.freeFloat * HOURS_PER_DAY, 
        totalFloatHours: spuTask.totalFloat * HOURS_PER_DAY, 
      };
    });

    return { tasks: calculatedTasks, projectDuration: result.projectDuration, criticalPath: result.criticalPath, isValid: true, errors: [] };
    } catch (error) {
      return { tasks: [], projectDuration: 0, criticalPath: [], isValid: false, errors: [error.message] };
    }
  }

  static validateNetwork(tasks) {
    const errors = [];
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { isValid: false, errors: ["Список задач пуст"] };
    }

    const taskIds = new Set();
    tasks.forEach(task => {
      if (!task.id || typeof task.id !== 'string' || !/^\d+-\d+$/.test(task.id.trim())) {
        errors.push(`Некорректный ID задачи: ${task.id}`);
      } else if (taskIds.has(task.id.trim())) {
        errors.push(`Дублирующаяся ID задачи: ${task.id}`);
      }
      taskIds.add(task.id.trim());
    });

    if (errors.length > 0) return { isValid: false, errors };

    try {
      const spuTasksForValidation = tasks.map(t => {
        const [from, to] = t.id.split('-');
        return new SPUTask(t.name, t.duration, from, to);
      });
      new SPUCalculation(spuTasksForValidation).calculateNetworkTimes();
    } catch (error) {
      errors.push(error.message);
    }

    return { isValid: errors.length === 0, errors };
  }
}

export const calculateNetworkParameters = SPUCalculation.calculateNetworkParameters;
export const validateNetwork = SPUCalculation.validateNetwork;
export const HOURS_PER_DAY =8;