import Image from "next/image";

const navLinks = ["Fleet", "Dispatch", "Fuel"];

export default function TopNavBar() {
  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant w-full h-[80px] sticky top-0 z-50">
      <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop w-full max-w-container-max mx-auto h-full">
        <div className="flex items-center gap-gutter">
          <span className="text-title-md font-title-md font-black text-primary">
            Airship Express
          </span>
          <nav className="hidden md:flex items-center gap-gutter ml-8">
            {navLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-secondary font-label-md text-label-md hover:text-primary transition-colors"
              >
                {link}
              </a>
            ))}
            <a
              href="#"
              className="text-primary border-b-2 border-primary pb-1 font-label-md text-label-md hover:text-primary transition-colors opacity-80 scale-95 transition-all"
            >
              Analysis
            </a>
            <a
              href="#"
              className="text-secondary font-label-md text-label-md hover:text-primary transition-colors"
            >
              Alerts
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-gutter">
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
              search
            </span>
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-body-md focus:ring-2 focus:ring-primary w-64"
            />
          </div>
          <button className="hidden lg:flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors">
            Book a Delivery
          </button>
          <button className="hidden lg:flex items-center gap-2 text-secondary font-label-md hover:text-primary transition-colors">
            Support
          </button>
          <button className="text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-outline-variant ml-2 relative">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZVcZAayF21o7TXLObZDfNzRMKL9xYfvH5AnBJTH7VjRFNOC7gtvk9ijehTta7vpU71sbMS1ZipN6q_UqDo_XxRVemmWy9lD7HTaSBb3tzGFr0isMJ0zwHalOBdYGYwzlkBeVnzyvMKknwUIgw80umDd7Z6_Ansv6AQ2QuVzNrmr0gCWbuFIBevtDqHBlJGsjpYygbop4iLunVByJhS6YJNPwnfwxuj4OCW-0g_LE5UgKniHPDS2m1zw"
              alt="User profile"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
