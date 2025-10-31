export class SPUTask {
  constructor(name, duration, from, to, laborIntensity = 0, numberOfPerformers = 1) {
    this.name = name;
    this.duration = parseFloat(duration);
    this.from = from;
    this.to = to;
    this.laborIntensity = parseFloat(laborIntensity) || this.duration * 8;
    this.numberOfPerformers = parseInt(numberOfPerformers) || 1;
    this.ES = 0;
    this.EF = 0;
    this.LS = 0;
    this.LF = 0;
    this._totalFloat = 0;
    this._freeFloat = 0;
  }

  get id() {
    return `${this.from}-${this.to}`;
  }

  get totalFloat() {
    return this._totalFloat;
  }

  set totalFloat(value) {
    this._totalFloat = value;
  }

  get freeFloat() {
    return this._freeFloat;
  }

  set freeFloat(value) {
    this._freeFloat = value;
  }

  get isCritical() {
    return Math.abs(this.totalFloat) < 0.001;
  }

  get predecessors() {
    return [];
  }
}

export class SPUCalculation {
  constructor(tasks) {
    this.tasks = tasks.map(task => {
      if (task instanceof SPUTask) {
        return task;
      }
      const [from, to] = task.id.split("-");
      return new SPUTask(
        task.name || task.id,
        task.duration,
        from,
        to,
        task.laborIntensity,
        task.numberOfPerformers
      );
    });
  }

  calculateEarlyStartAndFinish(overrides = {}) {
    const fromTo = [...new Set(this.tasks.flatMap(t => [t.from, t.to]))];
    const incoming = {};
    const outgoing = {};

    fromTo.forEach(node => {
      incoming[node] = [];
      outgoing[node] = [];
    });

    this.tasks.forEach(task => {
      incoming[task.to].push(task);
      outgoing[task.from].push(task);
    });

    const sortedNodes = this.sortNodes(fromTo, outgoing);
    const earlyEventTime = {};
    fromTo.forEach(node => {
      earlyEventTime[node] = 0;
    });

    sortedNodes.forEach(node => {
      outgoing[node].forEach(task => {
        const override = overrides[task.id];
        if (override && override.userDefinedStart !== undefined) {
          task.ES = override.userDefinedStart;
        } else {
          task.ES = earlyEventTime[node];
        }
        task.EF = task.ES + task.duration;
        earlyEventTime[task.to] = Math.max(earlyEventTime[task.to] || 0, task.EF);
      });
    });

    const lateEventTime = {};
    const projectDuration = Math.max(...Object.values(earlyEventTime));

    fromTo.forEach(node => {
      lateEventTime[node] = projectDuration;
    });

    const reversedNodes = [...sortedNodes].reverse();

    reversedNodes.forEach(node => {
      incoming[node].forEach(task => {
        task.LF = lateEventTime[node];
        task.LS = task.LF - task.duration;
        lateEventTime[task.from] = Math.min(lateEventTime[task.from], task.LS);
      });
    });

    this.tasks.forEach(task => {
      task.totalFloat = task.LS - task.ES;
      task.freeFloat = earlyEventTime[task.to] - task.EF;
    });

    return {
      tasks: this.tasks,
      projectDuration: projectDuration,
      criticalPath: this.findCriticalPath(),
      nodes: fromTo,
      earlyEventTime,
      lateEventTime
    };
  }

  sortNodes(nodes, outgoing) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (node) => {
      if (visiting.has(node)) {
        throw new Error(`Обнаружен цикл в сетевом графике в узле: ${node}`);
      }
      if (visited.has(node)) {
        return;
      }
      visiting.add(node);
      (outgoing[node] || []).forEach(task => {
        visit(task.to);
      });
      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    };

    const startNodes = nodes.filter(node => !this.tasks.some(t => t.to === node));
    startNodes.forEach(node => {
        if (!visited.has(node)) {
            visit(node);
        }
    });
    
    nodes.forEach(node => {
        if (!visited.has(node)) {
            visit(node);
        }
    });

    return sorted.reverse();
  }

  findCriticalPath() {
    const criticalTasks = this.tasks.filter(task => task.isCritical);
    if (criticalTasks.length === 0) return [];

    const path = [];
    const taskMap = new Map();
    criticalTasks.forEach(task => {
      if (!taskMap.has(task.from)) {
        taskMap.set(task.from, []);
      }
      taskMap.get(task.from).push(task);
    });

    const allToNodes = new Set(criticalTasks.map(t => t.to));
    const startNodes = criticalTasks.map(t => t.from).filter(from => !allToNodes.has(from));
    if (startNodes.length === 0 && criticalTasks.length > 0) {
        const allFromNodes = new Set(criticalTasks.map(t => t.from));
        const firstNode = criticalTasks.map(t => t.from).find(from => !allToNodes.has(from)) || criticalTasks[0].from;
        startNodes.push(firstNode);
    }
    
    let currentNode = startNodes[0];
    if(!currentNode) return [];
    
    path.push(currentNode);

    while (taskMap.has(currentNode)) {
      const nextTasks = taskMap.get(currentNode);
      if (nextTasks.length === 0) break;
      const nextTask = nextTasks[0];
      path.push(nextTask.to);
      currentNode = nextTask.to;
    }
    return path;
  }

  static calculateNetworkParameters(tasks, overrides = {}) {
    try {
      const spuTasks = tasks.map(task => {
        const [from, to] = task.id.split("-");
        return new SPUTask(
          task.name,
          task.duration,
          from,
          to,
          task.laborIntensity,
          task.numberOfPerformers
        );
      });

      const calculation = new SPUCalculation(spuTasks);
      const result = calculation.calculateEarlyStartAndFinish(overrides);

      const calculatedTasks = result.tasks.map(spuTask => ({
        id: spuTask.id,
        name: spuTask.name,
        duration: spuTask.duration,
        laborIntensity: spuTask.laborIntensity,
        numberOfPerformers: spuTask.numberOfPerformers,
        predecessors: tasks.find(t => t.id === spuTask.id)?.predecessors || [],
        isDummy: Boolean(tasks.find(t => t.id === spuTask.id)?.isDummy),
        sourceTaskId: tasks.find(t => t.id === spuTask.id)?.sourceTaskId,
        earlyStart: spuTask.ES,
        earlyFinish: spuTask.EF,
        lateStart: spuTask.LS,
        lateFinish: spuTask.LF,
        totalFloat: spuTask.totalFloat,
        freeFloat: spuTask.freeFloat,
        isCritical: spuTask.isCritical,
        earlyEventTimeI: result.earlyEventTime[spuTask.from],
        earlyEventTimeJ: result.earlyEventTime[spuTask.to],
        lateEventTimeI: result.lateEventTime[spuTask.from],
        lateEventTimeJ: result.lateEventTime[spuTask.to]
      }));

      return {
        tasks: calculatedTasks,
        projectDuration: result.projectDuration,
        criticalPath: result.criticalPath,
        isValid: true,
        errors: []
      };
    } catch (error) {
      return {
        tasks: [],
        projectDuration: 0,
        criticalPath: [],
        isValid: false,
        errors: [error.message]
      };
    }
  }

  static validateNetwork(tasks) {
    const errors = [];
    if (!Array.isArray(tasks) || tasks.length === 0) {
      errors.push("Список задач пуст");
      return { isValid: false, errors };
    }

    const taskIds = new Set();
    tasks.forEach(task => {
      if (!task.id || typeof task.id !== 'string' || !/^\d+-\d+$/.test(task.id.trim())) {
        errors.push(`Некорректный ID задачи: ${task.id}`);
      } else {
        if (taskIds.has(task.id.trim())) {
          errors.push(`Дублирующийся ID задачи: ${task.id}`);
        }
        taskIds.add(task.id.trim());
      }

      if (!task.name || String(task.name).trim() === "") {
        errors.push(`Отсутствует название для задачи: ${task.id}`);
      }
      const dur = Number(task.duration);
      if (isNaN(dur) || dur < 0) {
        errors.push(`Некорректная продолжительность для задачи: ${task.id}`);
      }
      const perf = parseInt(task.numberOfPerformers, 10);
      if (isNaN(perf) || perf <= 0) {
        errors.push(`Некорректное количество исполнителей для задачи: ${task.id}`);
      }
    });

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    try {
      const spuTasks = tasks.map(task => {
        const [from, to] = String(task.id).split("-");
        return new SPUTask(
          task.name,
          Number(task.duration),
          from,
          to,
          task.laborIntensity,
          task.numberOfPerformers
        );
      });
      const calculation = new SPUCalculation(spuTasks);
      calculation.calculateEarlyStartAndFinish();
    } catch (error) {
      errors.push(error.message);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const calculateNetworkParameters = SPUCalculation.calculateNetworkParameters;
export const validateNetwork = SPUCalculation.validateNetwork;
