'use client';

import { useEffect } from 'react';
import Canvas from '@/components/Canvas';

/* The canvas as a standalone hosted page.
 *
 * Used when the app is deployed as the canvas alone — the chat and search
 * surfaces need a local metasearch engine, a headless browser and a writable
 * database, none of which exist on a serverless host, so shipping them there
 * would only produce links that lead nowhere.
 *
 * Hides the navigation rail for the same reason the floating bar does: the
 * rail points at pages this deployment does not contain. */
const StandaloneShell = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('canvas-chromeless');
    return () => root.classList.remove('canvas-chromeless');
  }, []);

  return (
    <main className="h-[100dvh] overflow-hidden bg-light-primary dark:bg-dark-primary">
      <Canvas surface="page" />
    </main>
  );
};

export default StandaloneShell;
