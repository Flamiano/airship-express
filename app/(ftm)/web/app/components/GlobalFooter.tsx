export default function GlobalFooter() {
  return (
    <footer className="mt-auto w-full border-t border-pink-200/70 bg-white px-4 py-7 text-[#5b6b79] shadow-[0_-8px_24px_rgba(184,0,73,0.04)] sm:px-7">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-extrabold tracking-wide text-[#141d23]">AIRSHIP EXPRESS</div>
          <div className="mt-1 text-xs">© 2026 Airship Express Logistics. All rights reserved.</div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <a href="/dashboard" className="hover:text-[#b80049]">Operations Center</a>
          <a href="/alerts" className="hover:text-[#b80049]">Alerts</a>
          <a href="mailto:airshipexpress.s@gmail.com" className="hover:text-[#b80049]">Support</a>
          <a href="/vrds/parcels" className="hover:text-[#b80049]">Parcel Portal</a>
        </div>
      </div>
    </footer>
  );
}
