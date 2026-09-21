export default function DocumentLogo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="Airship Express" className="h-6 w-auto object-contain" />
      <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase">Airship Express</p>
    </div>
  );
}
