import { TopAppBar } from "./top-app-bar";
import { BottomNavBar } from "./bottom-nav-bar";

type AppShellProps = {
  children: React.ReactNode;
  topAppBarProps?: React.ComponentProps<typeof TopAppBar>;
};

export function AppShell({ children, topAppBarProps }: AppShellProps) {
  return (
    <>
      <TopAppBar {...topAppBarProps} />
      <main className="flex-grow pt-24 pb-32 px-6 md:px-16 max-w-[1200px] w-full mx-auto">
        {children}
      </main>
      <BottomNavBar />
    </>
  );
}
