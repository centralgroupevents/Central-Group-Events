import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" />
    </svg>
  );
}

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Services", href: "#services" },
    { name: "Events", href: "#events" },
    { name: "Pricing", href: "#pricing" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "glass-panel py-3" : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg group-hover:shadow-accent/50 transition-all duration-300">
            {/* TODO: replace with <img src="/images/cge-logo.png" alt="CGE Logo" className="w-10 h-10 object-contain" /> when logo is ready */}
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-primary transition-colors">
            CGE<span className="text-primary group-hover:text-white transition-colors">.</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
          <a
            href="https://calendly.com/centralgroupevents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
          >
            Book a Call
          </a>
          <a
            href="https://www.instagram.com/centralgroupevents/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="https://www.tiktok.com/@centralgroupevents"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-white transition-colors"
            aria-label="TikTok"
          >
            <TikTokIcon className="w-4 h-4" />
          </a>
          <Button
            asChild
            className="rounded-full bg-accent text-black hover:bg-accent/90 hover:scale-105 transition-all duration-300 font-semibold"
          >
            <a href="#book">Book Promotion</a>
          </Button>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-panel border-t border-white/5"
          >
            <div className="px-4 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-lg font-medium text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <a
                href="https://calendly.com/centralgroupevents/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-medium text-muted-foreground hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Book a Call
              </a>
              <div className="flex items-center gap-5 pt-1">
                <a
                  href="https://www.instagram.com/centralgroupevents/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.tiktok.com/@centralgroupevents"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-white transition-colors"
                  aria-label="TikTok"
                >
                  <TikTokIcon className="w-5 h-5" />
                </a>
              </div>
              <Button
                asChild
                className="w-full mt-2 rounded-xl bg-accent text-black hover:bg-accent/90"
                onClick={() => setMobileMenuOpen(false)}
              >
                <a href="#book">Book Promotion</a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
