import FtmProfileAvatar from "../../components/FtmProfileAvatar";

const NAV_ITEMS = ["Hub", "Shipments", "Sorting", "Analytics", "Fleet"];

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border pb-3 relative z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-brand font-bold text-xl tracking-wider">
          <i className="fa-solid fa-plane-departure" />
          <span>AIRSHIP EXPRESS</span>
        </div>
        <nav className="hidden md:flex gap-6 ml-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              className={`nav-link text-xs font-medium uppercase tracking-wide ${
                item === "Shipments"
                  ? "active text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-text-muted hover:text-brand transition-colors relative">
          <i className="fa-regular fa-bell text-lg" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent1 rounded-full" />
        </button>
        <button className="text-text-muted hover:text-brand transition-colors">
          <i className="fa-solid fa-cog text-lg" />
        </button>
        <FtmProfileAvatar name="Account" className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-bright text-xs font-bold" />
      </div>
    </header>
  );
}
