import FtmChatbotGate from "../components/global/FtmChatbotGate";

export default function FtmPagesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <FtmChatbotGate />
    </>
  );
}
