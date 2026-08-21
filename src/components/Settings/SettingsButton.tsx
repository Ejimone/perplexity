'use client';

import { Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsDialogue from './SettingsDialogue';
import { AnimatePresence } from 'framer-motion';

/* One settings button.
 *
 * There were two — this one for the desktop rail and SettingsButtonMobile for
 * the chat header — differing only in size and chrome while duplicating the
 * open/close state and the dialogue mount. Nav renders this at every
 * breakpoint now, so the mobile variant is gone. */
const SettingsButton = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      <button
        type="button"
        title="Settings"
        aria-label="Settings"
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center gap-y-0.5 rounded-lg py-1.5 text-black/60 transition duration-200 hover:text-black/80 active:scale-95 dark:text-white/60 dark:hover:text-white/80"
      >
        <span className="rounded-lg p-1.5 transition duration-200 hover:bg-light-200 dark:hover:bg-dark-200">
          <Settings size={21} />
        </span>
        <span className="text-[10px] leading-none">Settings</span>
      </button>
      <AnimatePresence>
        {isOpen && <SettingsDialogue isOpen={isOpen} setIsOpen={setIsOpen} />}
      </AnimatePresence>
    </>
  );
};

export default SettingsButton;
