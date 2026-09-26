import { MotionConfig } from "framer-motion";
import Navbar from "./components/Navbar";
import Sidebar, { SidebarProvider } from "./components/Sidebar";
import AuthGate from "./components/AuthGate";
import { HrAuthProvider } from "./lib/hr-auth";
import "./hrPerdev.css";

export default function PerformanceDevelopmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <HrAuthProvider>
        <AuthGate>
          <SidebarProvider>
            <div className="hr-perdev flex h-dvh w-full overflow-hidden bg-paper font-rethink text-ink dark:bg-ink dark:text-paper">
              <Sidebar />

              <div className="flex h-full min-w-0 flex-1 flex-col">
                <Navbar />

                <main
                  id="hr-main"
                  className="w-full min-w-0 flex-1 overflow-y-auto px-6 py-10 sm:px-10 sm:py-14"
                >
                  <div className="mx-auto w-full max-w-7xl">{children}</div>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </AuthGate>
      </HrAuthProvider>
    </MotionConfig>
  );
}
