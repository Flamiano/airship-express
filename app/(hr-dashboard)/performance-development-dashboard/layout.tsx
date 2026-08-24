import { MotionConfig } from "framer-motion";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AuthGate from "./components/AuthGate";
import { HrAuthProvider } from "./lib/hr-auth";
import { DevPreviewPanel } from "./lib/dev-preview";

export default function PerformanceDevelopmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <HrAuthProvider>
        <AuthGate>
          <div className="h-dvh w-full overflow-y-auto bg-paper font-rethink text-ink dark:bg-ink dark:text-paper">
            <Navbar />
            {process.env.NODE_ENV === "development" && <DevPreviewPanel />}

            <div className="mx-auto flex max-w-7xl flex-col sm:flex-row">
              <Sidebar />

              <main className="flex-1 px-6 py-10 sm:px-10 sm:py-14">
                {children}
              </main>
            </div>
          </div>
        </AuthGate>
      </HrAuthProvider>
    </MotionConfig>
  );
}
