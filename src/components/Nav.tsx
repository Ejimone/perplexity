'use client';

import { cn } from '@/lib/utils';
import { BookOpenText, Code2, Home, Plus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SettingsButton from './Settings/SettingsButton';
import { useView, type View } from '@/lib/hooks/useView';

/* The app's navigation.
 *
 * One component, one items array, one active rule, one set of markup. It was
 * previously two: a desktop rail and a separate mobile bottom bar, each with
 * its own navLinks.map and its own active-state styling — which had already
 * drifted apart. The two are now the same element, re-flowed at `lg` from a
 * bottom bar into a left rail, so they cannot diverge again.
 *
 * Every item keeps a real href. Discover and Library are views on `/` rather
 * than routes (see src/lib/hooks/useView.tsx for the function-budget reason),
 * but they are still linkable, so they get anchors and the click is merely
 * intercepted to avoid a pointless server round trip. Keeping real hrefs also
 * means middle-click and "open in new tab" behave normally.
 *
 * The hosted build used to hide Discover and Library behind
 * NEXT_PUBLIC_HOSTED, because those routes were not deployed. They cost no
 * functions now, so the flag is gone and both builds show the same navigation.
 */

const RAIL_WIDTH = 'lg:w-[72px]';

type NavItem = {
  key: View | 'canvas';
  label: string;
  icon: LucideIcon;
  href: string;
  /* Set when the item is a view on `/` rather than its own route. */
  view?: View;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'chat', label: 'Home', icon: Home, href: '/', view: 'chat' },
  {
    key: 'discover',
    label: 'Discover',
    icon: Search,
    href: '/?view=discover',
    view: 'discover',
  },
  {
    key: 'library',
    label: 'Library',
    icon: BookOpenText,
    href: '/?view=library',
    view: 'library',
  },
  { key: 'canvas', label: 'Canvas', icon: Code2, href: '/canvas' },
];

const Nav = () => {
  const pathname = usePathname();
  const { view, setView } = useView();

  /* The one active rule. /canvas is a real route; everything else is a view on
     the home route, so the current view names itself. */
  const activeKey: NavItem['key'] = pathname === '/canvas' ? 'canvas' : view;

  return (
    <nav
      /* globals.css hides [data-app-chrome] outright for the floating-bar and
         canvas-only surfaces, which have no use for app navigation. */
      data-app-chrome
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex flex-row items-center justify-between gap-x-2 border-t border-light-200 bg-light-secondary px-2 py-2 shadow-sm dark:border-dark-200 dark:bg-dark-secondary',
        'lg:inset-y-0 lg:right-auto lg:flex-col lg:justify-start lg:gap-y-5 lg:border-r lg:border-t-0 lg:px-2 lg:py-8',
        RAIL_WIDTH,
      )}
    >
      {/* Start a new thread. Rail only: on a phone the bottom bar is already
          five items wide, and Home with no ?c= does the same thing. */}
      <Link
        href="/"
        title="New chat"
        onClick={() => setView('chat')}
        className="hidden rounded-full bg-light-200 p-2.5 text-black/70 transition duration-200 hover:scale-105 hover:opacity-70 lg:block dark:bg-dark-200 dark:text-white/70"
      >
        <Plus size={19} />
      </Link>

      {NAV_ITEMS.map((item) => {
        const active = activeKey === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              /* Views switch in place; only /canvas is a real navigation.
                 Modified clicks are left alone so new-tab still works. */
              if (!item.view || pathname !== '/') return;
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              setView(item.view);
            }}
            className={cn(
              'group flex w-full flex-col items-center justify-center gap-y-0.5 rounded-lg py-1.5 transition duration-200',
              active
                ? 'text-black/80 dark:text-white/80'
                : 'text-black/60 hover:text-black/80 dark:text-white/60 dark:hover:text-white/80',
            )}
          >
            <span
              className={cn(
                'rounded-lg p-1.5 transition duration-200',
                active
                  ? 'bg-light-200 dark:bg-dark-200'
                  : 'group-hover:bg-light-200 dark:group-hover:bg-dark-200',
              )}
            >
              <item.icon size={21} />
            </span>
            <span className="text-[10px] leading-none">{item.label}</span>
          </Link>
        );
      })}

      {/* Pushed to the far end of the rail; inline in the bottom bar. */}
      <div className="flex w-full flex-col items-center lg:mt-auto">
        <SettingsButton />
      </div>
    </nav>
  );
};

export default Nav;
