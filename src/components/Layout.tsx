/* The centred content column used by the chat, Discover and Library views.
 *
 * The paddings clear the navigation, which is `fixed`: a 72px rail at `lg`
 * (Nav's RAIL_WIDTH) and a bottom bar below it. /canvas sets the same offsets
 * itself rather than using this component — an editor wants the full width,
 * not a max-w-screen-lg column. */
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-[100dvh] bg-light-primary pb-20 dark:bg-dark-primary lg:pb-0 lg:pl-[72px]">
      <div className="mx-4 max-w-screen-lg lg:mx-auto">{children}</div>
    </main>
  );
};

export default Layout;
