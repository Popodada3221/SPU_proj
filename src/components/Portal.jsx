import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let portalRoot = document.getElementById('portal-root');
    if (!portalRoot) {
      portalRoot = document.createElement('div');
      portalRoot.id = 'portal-root';
      document.body.appendChild(portalRoot);
    }
    return () => {
      setMounted(false);
      if (portalRoot && portalRoot.parentElement) {
      }
    };
  }, []);

  const portalRoot = typeof document !== 'undefined' ? document.getElementById('portal-root') : null;

  return mounted && portalRoot ? createPortal(children, portalRoot) : null;
};

export default Portal;