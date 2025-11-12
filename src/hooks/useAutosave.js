import { useEffect, useRef } from 'react';

const AUTOSAVE_INTERVAL = 5 * 60 * 1000; 
const STORAGE_KEY = 'spu_project_autosave';

export const useAutosave = (project, calculationResults) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (project && project.tasks && project.tasks.length > 0) {
        try {
          const dataToSave = {
            project,
            calculationResults,
            timestamp: new Date().toISOString(),
            version: '1.0'
          };

          localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
          console.log('Проект сохранен перед закрытием.');
        } catch (error) {
          console.error('Ошибка сохранения перед закрытием:', error);
        }
      }
    };


    window.addEventListener('beforeunload', handleBeforeUnload);


    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [project, calculationResults]);

  useEffect(() => {
    const saveData = () => {
      try {
        if (project.tasks.length === 0) return; 
        
        const dataToSave = {
          project,
          calculationResults,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        console.log('Проект автоматически сохранен:', new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Ошибка автосохранения:', error);
      }
    };


    intervalRef.current = setInterval(saveData, AUTOSAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [project, calculationResults]);

  const loadAutosavedData = () => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY); 
      if (savedData) {
        return JSON.parse(savedData);
      }
      return null;
    } catch (error) {
      console.error("Ошибка при чтении автосохраненных данных:", error);
      return null;
    }
  };

  const clearAutosavedData = () => {
    localStorage.removeItem(STORAGE_KEY); 
  };

  const hasAutosavedData = () => {
    return !!localStorage.getItem(STORAGE_KEY); 
  };

  return { loadAutosavedData, clearAutosavedData, hasAutosavedData };
};

export default useAutosave;