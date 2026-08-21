const footerLinks = [
  "Privacy Policy",
  "Terms of Service",
  "Fleet Portal",
  "Contact Support",
];

export default function Footer() {
  return (
    <footer className="mt-auto bg-surface-container-highest border-t border-outline-variant py-stack-lg">
      <div className="px-margin-mobile md:px-margin-desktop w-full max-w-container-max mx-auto flex flex-col gap-4">
        {/* Alert Banner */}
        <div
          className="bg-error text-on-error rounded-md p-4 flex flex-col sm:flex-row items-center justify-center gap-4 shadow-md bg-repeat"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiPjwvcmVjdD4KPHBhdGggZD0iTTAgMEw4IDhaTTAgOEw4IDBaIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiPjwvcGF0aD4KPC9zdmc+')",
          }}
        >
          <div className="flex items-center gap-2 font-title-md text-title-md font-bold">
            <span className="material-symbols-outlined icon-fill">
              ⚠
            </span>
            Overspend Alert!
          </div>
          <span className="text-body-md opacity-90 text-center sm:text-left">
            3 Assets Exceeding Budget
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          <button className="bg-surface-container-low text-primary border border-primary px-6 py-2 rounded-full font-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm">
            View Detailed Report
          </button>
          <button className="bg-surface-container-low text-primary border border-primary px-6 py-2 rounded-full font-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm">
            Export Cost Report
          </button>
          <button className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              ↟
            </span>{" "}
            Optimize Budget
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mt-6 pt-4 border-t border-outline-variant/50">
          <span className="font-title-md text-title-md text-on-surface">
            Airship Express
          </span>
          <div className="flex gap-4 mt-4 md:mt-0">
            {footerLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-secondary font-label-sm text-label-sm hover:underline hover:text-primary"
              >
                {link}
              </a>
            ))}
          </div>
          <span className="text-secondary font-label-sm text-label-sm mt-4 md:mt-0">
            © 2024 Airship Express Logistics. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
