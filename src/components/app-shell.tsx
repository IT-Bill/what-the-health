import { TopAppBar } from "./top-app-bar";
import { BottomNavBar } from "./bottom-nav-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopAppBar />
      <main className="flex-grow pt-24 pb-32 px-6 md:px-16 max-w-[1200px] w-full mx-auto">
        {children}
      </main>
      <BottomNavBar />
    </>
  );
}
