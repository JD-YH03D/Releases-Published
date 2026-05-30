import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Code, FolderOpen, Book, Keyboard, X, Terminal, Settings, ZoomIn, Info } from "lucide-react";

// Custom GitHub icon component
const GitHubIcon = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<<"production" | "legacy">("production");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const modalRef = useRef<<HTMLDivElement>(null);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsHeaderScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle modal close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        document.body.style.overflow = "unset";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openModal = () => {
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setIsModalOpen(false);
    document.body.style.overflow = "unset";
  };

  const handleModalClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      closeModal();
    }
  };

  const switchTab = (tab: "production" | "legacy") => {
    setActiveTab(tab);
  };

  const scrollToSection = (id: string) => {
    const element = document.querySelector(id);
    if (element) {
      const headerHeight = document.querySelector("header")?.offsetHeight || 0;
      const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - headerHeight - 16;
      window.scrollTo({ top: targetPosition, behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  const keyboardControls = [
    { key: "Tab", label: "Settings Panel", desc: "Open or close the settings interface" },
    { key: "V", label: "Info Panel", desc: "Toggle the location info display" },
    { key: "M", label: "Manual Marker", desc: "Place a marker on the game map" },
    { key: "X", label: "Refresh", desc: "Reset state for the next round" },
    { key: "1", label: "Auto Place", desc: "Place marker at the exact predicted position", isPrimary: true },
    { key: "2", label: "Safe Place", desc: "Place marker with a randomized offset", isPrimary: true },
    { key: "S", label: "Zoom In", desc: "Increase the mini-map zoom level" },
    { key: "A", label: "Zoom Out", desc: "Decrease the mini-map zoom level" },
    { key: "C", label: "Copy Coords", desc: "Copy current coordinates to clipboard" },
    { key: "G", label: "Google Maps", desc: "Open the current location in Google Maps" },
    { key: "D", label: "Discord", desc: "Send the location data to a Discord webhook", isDiscord: true },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[radial-gradient(rgba(59,130,246,0.07)_1px,transparent_1px)] bg-[20px_20px]" aria-hidden="true" />
      
      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, visibility: "hidden" }}
            animate={{ opacity: 1, visibility: "visible" }}
            exit={{ opacity: 0, visibility: "hidden" }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 md:p-6"
            onClick={handleModalClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.25, type: "spring", damping: 25 }}
              className="relative max-w-2xl w-full mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900/80 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Keyboard className="text-emerald-400 text-sm" size={16} />
                  <h3 id="modal-title" className="font-semibold text-white text-sm tracking-wide uppercase">
                    GeoGuessr Controls
                  </h3>
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 max-h-[65vh] overflow-y-auto">
                <div className="overflow-hidden border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/50 text-slate-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold border-b border-slate-800 w-1/4">Key</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-800 w-1/4">Function</th>
                        <th className="px-4 py-3 font-semibold border-b border-slate-800 hidden sm:table-cell">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {keyboardControls.map((control, index) => (
                        <motion.tr
                          key={control.key}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <kbd className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-bold text-emerald-400 bg-slate-800/70 border border-slate-700 rounded shadow-[0_2px_0_rgba(0,0,0,0.3)]">
                              {control.key}
                            </kbd>
                          </td>
                          <td className={`px-4 py-3 text-xs font-medium ${control.isDiscord ? "text-[#5865F2]" : control.isPrimary ? "text-emerald-400" : "text-white"}`}>
                            {control.label}
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden sm:table-cell text-xs">
                            {control.desc}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-900/30 border-t border-slate-800 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
          isHeaderScrolled
            ? "bg-slate-950/80 backdrop-blur-xl border-slate-800/50 shadow-lg shadow-slate-950/20"
            : "bg-slate-950/50 border-slate-800/30"
        }`}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.a
            href="#"
            className="flex items-center space-x-4 group"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("#");
            }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition" aria-hidden="true" />
              <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-inner">
                <img
                  src="https://raw.githubusercontent.com/JD-YH03D/Releases-Published/main/public/image/hero1.png"
                  alt="JD-YH03D Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/40x40/0f172a/60a5fa?text=JD";
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-white">JD-YH03D</span>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Scripts Hub</span>
            </div>
          </motion.a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold uppercase tracking-wider" aria-label="Main navigation">
            {[
              { href: "#directory", label: "Directory" },
              { href: "#documentation", label: "Docs" },
              { href: "https://github.com/JD-YH03D/Releases-Published/issues", label: "Issues", icon: <GitHubIcon size={12} />, external: true, iconColor: "text-red-400" },
            ].map((item, index) => (
              <motion.a
                key={item.href}
                href={item.href}
                className={`transition-colors duration-200 flex items-center ${
                  item.label === "Issues" ? "text-slate-400 hover:text-red-400" : "text-slate-400 hover:text-blue-400"
                }`}
                onClick={(e) => {
                  if (item.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToSection(item.href);
                  }
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {item.icon && <span className="mr-1.5 opacity-70">{item.icon}</span>}
                {item.label}
              </motion.a>
            ))}
            <motion.a
              href="https://github.com/JD-YH03D/Releases-Published"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 text-white transition flex items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <GitHubIcon size={14} className="mr-2" />
              GitHub
            </motion.a>
          </nav>

          {/* Mobile Hamburger */}
          <button
            id="mobile-menu-btn"
            className="md:hidden text-slate-400 hover:text-white transition w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-800"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Code size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <motion.div
          id="mobile-menu"
          initial={false}
          animate={isMobileMenuOpen ? "open" : "closed"}
          variants={{
            open: { opacity: 1, height: "auto", marginTop: 0 },
            closed: { opacity: 0, height: 0, marginTop: 0 },
          }}
          className="md:hidden overflow-hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl"
        >
          <nav className="flex flex-col py-4 px-6 space-y-1" aria-label="Mobile navigation">
            {[
              { href: "#directory", label: "Directory", icon: FolderOpen, color: "text-blue-500" },
              { href: "#documentation", label: "Documentation", icon: Book, color: "text-purple-500" },
              { href: "https://github.com/JD-YH03D/Releases-Published/issues", label: "Issues", icon: GitHubIcon, color: "text-red-500", external: true },
              { href: "https://github.com/JD-YH03D/Releases-Published", label: "GitHub Repository", icon: GitHubIcon, color: "text-slate-400", external: true },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-slate-400 hover:text-white hover:bg-slate-800/50 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                onClick={(e) => {
                  if (item.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToSection(item.href);
                  }
                }}
              >
                <item.icon size={16} className={`mr-3 ${item.color}`} />
                {item.label}
              </a>
            ))}
          </nav>
        </motion.div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-6 max-w-6xl relative">
        {/* Hero Section */}
        <section className="py-16 md:py-24 flex flex-col md:flex-row items-center gap-12 md:gap-16">
          <motion.div className="flex-1 text-center md:text-left" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            {/* Badge */}
            <motion.div
              className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full mb-6"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Version 1.0.0 — Production Live</span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              className="text-4xl md:text-6xl font-black mb-6 leading-[1.1] tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            >
              Web Automation
              <br />
              <span className="text-blue-500">Script Engine</span>
            </motion.h1>

            <motion.p
              className="text-slate-400 text-base md:text-lg mb-10 max-w-xl leading-relaxed mx-auto md:mx-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              A centralized hub for high-quality UserScripts. Built for maximum performance, long-term stability, and seamless browser integration.
            </motion.p>

            {/* CTA */}
            <motion.div
              className="flex flex-wrap gap-4 justify-center md:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <motion.a
                href="#directory"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("#directory");
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-transform shadow-lg shadow-blue-500/35 flex items-center cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Explore Scripts
                <ChevronRight size={16} className="ml-3 opacity-70" />
              </motion.a>
              <motion.a
                href="#documentation"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("#documentation");
                }}
                className="bg-slate-900/50 backdrop-blur hover:bg-slate-800 text-slate-300 px-8 py-3.5 rounded-xl font-bold transition border border-slate-800"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Documentation
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            className="flex-1 w-full max-w-lg hidden lg:block"
            aria-hidden="true"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-700" />
              <div className="relative bg-slate-950/90 border border-slate-800 p-6 rounded-2xl shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/40 border border-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/40 border border-green-500/50" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">engine_status: stable</span>
                </div>
                <div className="space-y-4">
                  <motion.div className="h-2.5 w-3/4 bg-slate-800/70 rounded-full" initial={{ width: 0 }} animate={{ width: "75%" }} transition={{ duration: 1, ease: "easeOut" }} />
                  <motion.div className="h-2.5 w-full bg-slate-800/50 rounded-full" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} />
                  <motion.div className="h-2.5 w-5/6 bg-slate-800/70 rounded-full" initial={{ width: 0 }} animate={{ width: "83.33%" }} transition={{ duration: 1, ease: "easeOut", delay: 0.3 }} />
                  <motion.div className="h-2.5 w-2/3 bg-slate-800/50 rounded-full" initial={{ width: 0 }} animate={{ width: "66.67%" }} transition={{ duration: 1, ease: "easeOut", delay: 0.4 }} />
                  <motion.div className="flex gap-3 pt-4">
                    <div className="h-8 w-16 bg-blue-500/15 border border-blue-500/20 rounded-lg" />
                    <div className="h-8 w-28 bg-slate-800/50 rounded-lg" />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Directory Section */}
        <section id="directory" className="py-20 border-t border-slate-900">
          <motion.div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div>
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Active Directory</h2>
              <p className="text-slate-500 text-sm">Official script repository and production builds.</p>
            </div>
            {/* Tab Filter */}
            <motion.div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 w-fit" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <motion.button
                id="tab-production"
                onClick={() => switchTab("production")}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "production" ? "text-white bg-blue-600 shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Production
              </motion.button>
              <motion.button
                id="tab-legacy"
                onClick={() => switchTab("legacy")}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "legacy" ? "text-white bg-blue-600 shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Legacy
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Production View */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === "production" ? 100 : -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === "production" ? -100 : 100 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              {activeTab === "production" && (
                <div className="grid grid-cols-1 gap-10">
                  {/* GeoGuessr Card */}
                  <motion.article className="rounded-2xl overflow-hidden group border bg-slate-800/30 backdrop-blur-xl border-slate-700/50 hover:border-emerald-500/30 transition-all" aria-label="GeoGuessr Script">
                    <div className="bg-slate-900/60 px-6 py-5 border-b border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition" aria-hidden="true" />
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-900">
                            <img
                              src="https://raw.githubusercontent.com/JD-YH03D/Releases-Published/main/public/image/geoguessr.jpg"
                              alt="GeoGuessr"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/48x48/0f172a/10b981?text=GG";
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">GeoGuessr — Exploration Suite</h3>
                          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">v2.0.0-stable</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <button onClick={openModal} className="text-xs font-bold text-emerald-400 hover:bg-emerald-400/10 px-4 py-2 rounded-lg transition border border-emerald-400/20 flex items-center">
                          <Book size={14} className="mr-2" />
                          Guide
                        </button>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-950/50 px-3 py-1.5 rounded-md border border-slate-800">1 ASSET</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-950/40">
                          <tr>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50">Build Name</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50 hidden sm:table-cell">Optimization</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50 text-right w-36">Deployment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {[
                            { version: "v2.0.0-release.js", desc: "Latest stable build with full feature set.", url: "https://greasyfork.org/id/scripts/578278-geoguessr-let-s-explore-the-world" },
                          ].map((item, index) => (
                            <motion.tr key={item.version} className="hover:bg-emerald-500/[0.04] transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.1 }}>
                              <td className="px-6 py-4 font-mono text-emerald-400 font-medium text-xs">{item.version}</td>
                              <td className="px-6 py-4 text-slate-400 text-xs hidden sm:table-cell">{item.desc}</td>
                              <td className="px-6 py-4 text-right">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-[10px] font-black uppercase text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-5 py-2.5 rounded-lg transition tracking-widest"
                                >
                                  Install
                                </a>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.article>

                  {/* Chess.com Card */}
                  <motion.article className="rounded-2xl overflow-hidden group border bg-slate-800/30 backdrop-blur-xl border-slate-700/50 hover:border-[#769656]/30 transition-all" aria-label="Chess.com Script">
                    <div className="bg-slate-900/60 px-6 py-5 border-b border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="relative w-12 h-12 flex-shrink-0">
                          <div className="absolute inset-0 bg-[#769656]/20 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition" aria-hidden="true" />
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#769656]/30 bg-slate-900">
                            <img
                              src="https://raw.githubusercontent.com/JD-YH03D/Releases-Published/main/public/image/chess.com.png"
                              alt="Chess.com"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/48x48/0f172a/769656?text=Chess";
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">Chess.com — Board Analysis</h3>
                          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">v1.0.0-stable</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-950/50 px-3 py-1.5 rounded-md border border-slate-800">1 ASSET</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-950/40">
                          <tr>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50">Build Name</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50 hidden sm:table-cell">Details</th>
                            <th className="px-6 py-4 font-bold border-b border-slate-800/50 text-right w-36">Deployment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          <motion.tr className="hover:bg-[#769656]/[0.05] transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                            <td className="px-6 py-4 font-mono text-[#8fa866] font-medium text-xs">v1.0.0-release.js</td>
                            <td className="px-6 py-4 text-slate-400 text-xs hidden sm:table-cell">Initial build for board detection and analysis.</td>
                            <td className="px-6 py-4 text-right">
                              <a
                                href="https://raw.githubusercontent.com/JD-YH03D/Releases-Published/refs/heads/main/Chess.com%20-%20Play%20Chess%20Online%20-%20Free%20Games/version1.0.0-release.js"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-[10px] font-black uppercase text-white bg-[#769656] hover:bg-[#8fa866] active:bg-[#5a7340] px-5 py-2.5 rounded-lg transition tracking-widest"
                              >
                                Install
                              </a>
                            </td>
                          </motion.tr>
                        </tbody>
                      </table>
                    </div>
                  </motion.article>

                  {/* Coming Soon */}
                  <motion.div className="border-2 border-dashed border-slate-800/60 p-12 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-slate-700 transition-colors" role="presentation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="h-14 w-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-600 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-colors">
                      <ChevronRight size={24} />
                    </div>
                    <p className="text-slate-400 text-sm font-bold tracking-wide">More Projects Coming Soon</p>
                    <p className="text-slate-600 text-xs mt-1.5">New scripts are currently under active development.</p>
                  </motion.div>
                </div>
              )}

              {activeTab === "legacy" && (
                <motion.div className="py-20 flex flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-5 text-slate-600">
                    <FolderOpen size={24} />
                  </div>
                  <p className="text-slate-400 text-base font-bold">Legacy Archive</p>
                  <p className="text-slate-600 text-sm mt-2 max-w-xs">Older script versions are not publicly available. Please contact the developer for access.</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Documentation Section */}
        <section id="documentation" className="py-24 border-t border-slate-900">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left Column */}
            <motion.div className="space-y-8" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
              <div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Standardized Architecture</h2>
                <p className="text-slate-400 leading-relaxed">
                  All scripts conform to the <span className="text-blue-400 font-bold">Standardized Script Schema (S3)</span>. We prioritize code security, runtime performance, and a smooth experience for end users.
                </p>
              </div>

              <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {[
                  { icon: ZoomIn, title: "ES6+ Standards", desc: "Modern syntax with high-level runtime optimizations.", color: "text-blue-500", bg: "bg-blue-500/10" },
                  { icon: Info, title: "Namespace Validation", desc: "Mandatory UserScript headers for browser environment validation.", color: "text-purple-500", bg: "bg-purple-500/10" },
                  { icon: Code, title: "Semantic Versioning", desc: "Every release strictly follows the SemVer specification.", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { icon: Settings, title: "Auto-Update Ready", desc: "Fully compatible with the Tampermonkey auto-update system.", color: "text-orange-500", bg: "bg-orange-500/10" },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    className={`p-5 rounded-2xl border border-slate-800 hover:border-${item.color.replace("text-", "")}/20 transition-colors`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center border ${item.color.replace("text-", "border-")}/20 mb-4`}>
                      <item.icon size={18} className={item.color} />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-2">{item.title}</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div className="pt-6 border-t border-slate-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <a
                  href="https://github.com/JD-YH03D/Releases-Published/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-3 w-fit"
                >
                  <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:bg-red-500/20 group-hover:border-red-500/40 transition-all">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-300 block group-hover:text-white transition-colors">Found a Bug?</span>
                    <span className="text-[11px] text-slate-500 font-medium">Open an Issue on GitHub →</span>
                  </div>
                </a>
              </motion.div>
            </motion.div>

            {/* Right Column — Terminal */}
            <motion.div
              className="bg-[#0b1120] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl"
              role="complementary"
              aria-label="Terminal preview"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border-b border-slate-800">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/40" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/30 border border-yellow-500/40" />
                  <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/40" />
                </div>
                <div className="flex items-center text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                  <Terminal size={12} className="mr-2" />
                  development_shell
                </div>
              </div>
              <div className="p-6 text-[12px] font-mono leading-relaxed overflow-x-auto">
                <div className="flex gap-4 mb-1">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">1</span>
                  <p className="text-slate-500"># Clone the repository</p>
                </div>
                <div className="flex gap-4 mb-1">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">2</span>
                  <p className="text-blue-400">
                    git clone <span className="text-emerald-400">"&quot;https://github.com/JD-YH03D/Scripts&quot;"</span>
                  </p>
                </div>
                <div className="flex gap-4 mb-4">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">3</span>
                  <p className="text-blue-400">
                    cd <span className="text-slate-300">Scripts/build</span>
                  </p>
                </div>
                <div className="flex gap-4 mb-1">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">4</span>
                  <p className="text-slate-500"># Install dependencies and optimize</p>
                </div>
                <div className="flex gap-4 mb-4">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">5</span>
                  <p className="text-blue-400">
                    npm <span className="text-slate-300">install</span> && npm <span className="text-slate-300">run optimize</span>
                  </p>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-700 select-none w-4 text-right flex-shrink-0">6</span>
                  <p className="text-emerald-400 font-bold">
                    ✓ Build success: <span className="text-slate-300 font-normal">2 packages optimized.</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <motion.footer className="py-14 border-t border-slate-900 bg-slate-950 mt-12" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            {/* Left */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200/20">
                  <Code size={18} className="text-white" />
                </div>
                <span className="font-black text-white text-lg tracking-tight">JD-YH03D</span>
              </div>
              <p className="text-slate-600 text-xs font-medium">© 2024 JD-YH03D. Released under the MIT License.</p>
              <p className="text-slate-700 text-[10px] mt-1 uppercase tracking-tight max-w-xs">Production-Grade Web Automation Solutions.</p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="flex items-center space-x-6">
                <a href="#directory" className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Scripts</a>
                <a href="#documentation" className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Docs</a>
                <a
                  href="https://github.com/JD-YH03D/Releases-Published"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Repository"
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition-all shadow-inner"
                >
                  <GitHubIcon size={18} />
                </a>
              </div>
              <p className="text-slate-700 text-[10px] font-mono tracking-widest">v2.4.0-REV2024</p>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
