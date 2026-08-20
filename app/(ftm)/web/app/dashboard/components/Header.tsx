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
        <div className="w-8 h-8 rounded-full bg-surface-bright border border-border flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="User Avatar"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpeaD1V5j44D-Ka_wd_sLT097SKm2tOizHvyZXUbCWE3cQq-BO66TXId-i6MUITxqHNlW--oYTiFWqe__wL6C2aGpEXIq3Jn0kZGCiIr9wvXI5gZObftl__Pfy73jmHx0Hb_P0wZyYdLJxjJE1x2dw5WsLcc_MxJhxYOgjcV6p45a17G5D_QQi9Q-jDp6Og_P8ZVHOz5FX8bvkYwTRxmM4MryKmVnehvzPHD9OyuDEp9eT1wT0oQgv1Q"
          />
        </div>
      </div>
    </header>
  );
}
