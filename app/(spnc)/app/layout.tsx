import { ShellProvider } from "../components/ShellContext";
import AppFrame from "../components/AppFrame";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ShellProvider>
      <AppFrame>{children}</AppFrame>
    </ShellProvider>
  );
}