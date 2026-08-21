import { Dialog, DialogPanel } from '@headlessui/react';
import {
  BrainCog,
  ChevronLeft,
  Search,
  Sliders,
  ToggleRight,
} from 'lucide-react';
import Preferences from './Sections/Preferences';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import Models from './Sections/Models/Section';
import SearchSection from './Sections/Search';
import Personalization from './Sections/Personalization';

const sections = [
  {
    key: 'preferences',
    name: 'Preferences',
    description: 'Customize your application preferences.',
    icon: Sliders,
    component: Preferences,
    dataAdd: 'preferences',
  },
  {
    key: 'personalization',
    name: 'Personalization',
    description: 'Customize the behavior and tone of the model.',
    icon: ToggleRight,
    component: Personalization,
    dataAdd: 'personalization',
  },
  {
    key: 'models',
    name: 'Models',
    description: 'Connect to AI services and manage connections.',
    icon: BrainCog,
    component: Models,
    dataAdd: 'modelProviders',
  },
  {
    key: 'search',
    name: 'Search',
    description: 'Manage search settings.',
    icon: Search,
    component: SearchSection,
    dataAdd: 'search',
  },
];

const SettingsDialogue = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (active: boolean) => void;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<string>(sections[0].key);
  const [selectedSection, setSelectedSection] = useState(sections[0]);

  useEffect(() => {
    setSelectedSection(sections.find((s) => s.key === activeSection)!);
  }, [activeSection]);

  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          const res = await fetch('/api/config', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await res.json();

          setConfig(data);
        } catch (error) {
          console.error('Error fetching config:', error);
          toast.error('Failed to load configuration.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }
  }, [isOpen]);

  const selected = selectedSection;

  return (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      className="relative z-50"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 flex h-[100dvh] w-screen items-center justify-center bg-black/30 p-2 backdrop-blur-sm sm:p-4"
      >
        {/* dvh, not vh: on a phone the browser's collapsing chrome makes vh
            taller than the visible viewport, so the panel's bottom edge — and
            with it the save buttons inside each section — sat under the URL
            bar. */}
        <DialogPanel className="flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-xl border border-light-200 bg-light-primary backdrop-blur-lg sm:h-[calc(100dvh-2rem)] lg:h-[min(46rem,calc(100dvh-8rem))] lg:w-[min(64rem,calc(100vw-8rem))] dark:border-dark-200 dark:bg-dark-primary">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader />
            </div>
          ) : (
            /* One section list, not two.
             *
             * This was a fixed 240px rail plus a completely separate <Select>
             * for small screens — two navigation implementations for one
             * concept, the same duplication the app-level Sidebar had. It is
             * now a single list that reflows: a horizontally scrollable tab
             * strip on a phone, a rail from lg up. */
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="flex shrink-0 flex-row items-center gap-x-2 border-b border-light-200 px-2 py-2 lg:w-56 lg:flex-col lg:items-stretch lg:gap-y-1 lg:border-b-0 lg:border-r lg:px-3 lg:py-3 dark:border-dark-200">
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close settings"
                  className="group flex shrink-0 flex-row items-center rounded-lg p-2 hover:bg-light-200 lg:mb-6 lg:self-start dark:hover:bg-dark-200"
                >
                  <ChevronLeft
                    size={18}
                    className="text-black/50 group-hover:text-black/70 dark:text-white/50 dark:group-hover:text-white/70"
                  />
                  <p className="hidden text-[14px] text-black/50 group-hover:text-black/70 lg:block dark:text-white/50 dark:group-hover:text-white/70">
                    Back
                  </p>
                </button>

                {/* overflow-hidden-scrollable is the app's existing
                    hide-the-scrollbar utility (globals.css). */}
                <div className="overflow-hidden-scrollable flex flex-1 flex-row gap-x-1 overflow-x-auto lg:flex-col lg:gap-y-1 lg:overflow-x-visible">
                  {sections.map((section) => (
                    <button
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      aria-current={
                        activeSection === section.key ? 'true' : undefined
                      }
                      className={cn(
                        'flex shrink-0 flex-row items-center gap-x-2 rounded-lg px-2.5 py-1.5 text-sm transition duration-200 active:scale-95 hover:bg-light-200 lg:w-full dark:hover:bg-dark-200',
                        activeSection === section.key
                          ? 'bg-light-200 text-black/90 dark:bg-dark-200 dark:text-white/90'
                          : 'text-black/70 dark:text-white/70',
                      )}
                    >
                      <section.icon size={17} className="shrink-0" />
                      <p className="whitespace-nowrap">{section.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                {selected.component && (
                  <>
                    <div className="shrink-0 border-b border-light-200/60 px-4 py-4 lg:px-6 lg:py-5 dark:border-dark-200/60">
                      <h4 className="text-sm font-medium text-black dark:text-white">
                        {selected.name}
                      </h4>
                      <p className="text-[11px] text-black/50 lg:text-xs dark:text-white/50">
                        {selected.description}
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <selected.component
                        fields={config.fields[selected.dataAdd]}
                        values={config.values[selected.dataAdd]}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogPanel>
      </motion.div>
    </Dialog>
  );
};

export default SettingsDialogue;
