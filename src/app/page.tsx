"use client";

import Link from "next/link";
import { useEffect, useState, useRef, MouseEvent } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import Footer from "./Components/layout/Footer";
import { LuChartBar, LuMessageCircle, LuSwords, LuTarget, LuTrendingUp, LuZap } from "react-icons/lu";
import { useTranslation } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// ============================================================
// ANIMATION VARIANTS
// ============================================================

const fadeUpVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.25, 0.4, 0.25, 1] as const,
    },
  }),
};

const glowPulse = {
  initial: { boxShadow: "0 0 0 rgba(0, 255, 255, 0)" },
  hover: {
    boxShadow: [
      "0 0 20px rgba(0, 255, 255, 0.3)",
      "0 0 40px rgba(0, 255, 255, 0.5)",
      "0 0 20px rgba(0, 255, 255, 0.3)",
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ============================================================
// COMPONENTS
// ============================================================

// Magnetic Button Component
function MagneticButton({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * 0.3;
    const deltaY = (e.clientY - centerY) * 0.3;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const springConfig = { stiffness: 300, damping: 20 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.a>
  );
}

// 3D Tilt Card Component
function TiltCard({ children, className, glowColor = "cyan" }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPos = (e.clientX - rect.left) / rect.width - 0.5;
    const yPos = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPos);
    y.set(yPos);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const glowColors: Record<string, string> = {
    cyan: "rgba(0, 255, 255, 0.4)",
    purple: "rgba(168, 85, 247, 0.4)",
    amber: "rgba(251, 191, 36, 0.4)",
    emerald: "rgba(52, 211, 153, 0.4)",
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      whileHover={{
        boxShadow: `0 0 30px ${glowColors[glowColor] || glowColors.cyan}`,
      }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Floating Particles Component (uses fixed positions to avoid hydration mismatch)
function FloatingParticles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fixed particle positions to avoid hydration mismatch
  const particles = [
    { id: 0, x: 15, y: 20, size: 2, duration: 18, delay: 0 },
    { id: 1, x: 85, y: 15, size: 3, duration: 22, delay: 1 },
    { id: 2, x: 45, y: 80, size: 2, duration: 15, delay: 2 },
    { id: 3, x: 70, y: 45, size: 4, duration: 20, delay: 0.5 },
    { id: 4, x: 25, y: 65, size: 2, duration: 17, delay: 3 },
    { id: 5, x: 90, y: 70, size: 3, duration: 25, delay: 1.5 },
    { id: 6, x: 10, y: 85, size: 2, duration: 19, delay: 2.5 },
    { id: 7, x: 55, y: 25, size: 3, duration: 21, delay: 0.8 },
    { id: 8, x: 35, y: 55, size: 2, duration: 16, delay: 4 },
    { id: 9, x: 75, y: 90, size: 4, duration: 23, delay: 1.2 },
    { id: 10, x: 5, y: 40, size: 2, duration: 18, delay: 3.5 },
    { id: 11, x: 60, y: 10, size: 3, duration: 20, delay: 2.2 },
    { id: 12, x: 40, y: 70, size: 2, duration: 14, delay: 4.5 },
    { id: 13, x: 95, y: 35, size: 3, duration: 22, delay: 0.3 },
    { id: 14, x: 20, y: 95, size: 2, duration: 17, delay: 1.8 },
    { id: 15, x: 80, y: 60, size: 4, duration: 24, delay: 2.8 },
  ];

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-cyan-400/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Grid Background Component
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Animated scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
        animate={{
          top: ["-10%", "110%"],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

// Mouse Follow Glow Component (client-only to avoid hydration issues)
function MouseFollowGlow() {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!mounted) return null;

  return (
    <motion.div
      className="fixed w-[400px] h-[400px] rounded-full pointer-events-none z-0"
      style={{
        background: "radial-gradient(circle, rgba(0, 255, 255, 0.08) 0%, transparent 70%)",
        left: mousePos.x - 200,
        top: mousePos.y - 200,
      }}
      animate={{
        left: mousePos.x - 200,
        top: mousePos.y - 200,
      }}
      transition={{
        type: "spring",
        stiffness: 150,
        damping: 15,
      }}
    />
  );
}

// Typing Effect Component
function TypingText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[3px] h-[1em] bg-cyan-400 ml-1 align-middle"
      />
    </span>
  );
}

// Stats Counter Component (client-only animation)
function StatsCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(value); // Start with final value for SSR

  useEffect(() => {
    setMounted(true);
    setCount(0); // Reset to 0 for animation

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function LandingPage() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });

  // Parallax transforms
  const bgY1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const bgY2 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0f] text-white font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      {/* Mouse Follow Glow */}
      <MouseFollowGlow />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-cyan-500/10" : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-2xl font-black tracking-tight">
              <span className="text-cyan-400">LoL</span> Coach AI
            </span>
          </motion.div>
          <div className="flex gap-4 items-center">
            <LanguageSwitcher />
            <Link
              href="/champions"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden md:block"
            >
              {t('publicNav.champions')}
            </Link>
            <Link
              href="/items"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden md:block"
            >
              {t('publicNav.items')}
            </Link>
            <Link
              href="/guide/gold"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden md:block"
            >
              {t('publicNav.guideGold')}
            </Link>
            <Link
              href="/guide/runes"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition hidden md:block"
            >
              {t('publicNav.guideRunes')}
            </Link>
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              {t('landingPage.nav.pricing')}
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              {t('landingPage.nav.login')}
            </Link>
            <MagneticButton
              href="/signup"
              className="px-5 py-2.5 text-sm font-bold bg-cyan-500 text-black rounded-lg transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
            >
              {t('landingPage.nav.getStarted')}
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Effects */}
        <GridBackground />
        <FloatingParticles />

        {/* Floating Glow Orbs - Parallax */}
        <motion.div
          style={{ y: bgY1 }}
          className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]"
        />
        <motion.div
          style={{ y: bgY2 }}
          className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px]"
        />

        <div className="container mx-auto px-6 relative z-10">
          {/* Main Hero Content */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.span
                className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-400 border border-cyan-500/30 rounded-full mb-8 bg-cyan-500/5"
                animate={{
                  boxShadow: ["0 0 20px rgba(0,255,255,0)", "0 0 20px rgba(0,255,255,0.3)", "0 0 20px rgba(0,255,255,0)"]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                AI-Powered Coaching
              </motion.span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6"
            >
              <span className="block text-white">LEVEL UP</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                YOUR RANK
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              {t('landingPage.hero.subtitle')}<br className="hidden md:block" />
              {t('landingPage.hero.subtitlePrefix')}<span className="text-cyan-400 font-semibold">{t('landingPage.hero.subtitleHighlight')}</span>{t('landingPage.hero.subtitleEnd')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <MagneticButton
                href="/signup"
                className="group relative px-8 py-4 text-lg font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg overflow-hidden"
              >
                <span className="relative z-10">{t('landingPage.hero.ctaStart')}</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </MagneticButton>
              <MagneticButton
                href="/analyze"
                className="group relative px-8 py-4 text-lg font-bold border-2 border-emerald-500/50 text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition"
              >
                <span className="relative z-10">{t('landingPage.hero.ctaAnalyze')}</span>
              </MagneticButton>
            </motion.div>

            {/* Free Analysis Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-6 flex justify-center"
            >
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {t('landingPage.hero.freeBadge')}
              </Link>
            </motion.div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-12 gap-4 max-w-6xl mx-auto">
            {/* Main Stats Card - Large */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-12 md:col-span-8"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 md:p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors"
                glowColor="cyan"
              >
                <div className="flex flex-col md:flex-row gap-6 h-full">
                  {/* Radar Chart Mock */}
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <div className="relative w-40 h-40 md:w-48 md:h-48">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {/* Background circles */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        {/* Radar polygon */}
                        <motion.polygon
                          points="50,10 85,35 75,80 25,80 15,35"
                          fill="rgba(0, 255, 255, 0.15)"
                          stroke="rgba(0, 255, 255, 0.8)"
                          strokeWidth="2"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                        {/* Data points */}
                        {[[50, 10], [85, 35], [75, 80], [25, 80], [15, 35]].map(([cx, cy], i) => (
                          <motion.circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r="4"
                            fill="#00ffff"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.8 + i * 0.1 }}
                          />
                        ))}
                      </svg>
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full" />
                    </div>
                  </div>

                  {/* Stats Content */}
                  <div className="flex-1">
                    <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2">Skill Analysis</div>
                    <h3 className="text-2xl font-bold mb-4">{t('landingPage.bento.skillAnalysis')}</h3>
                    <p className="text-gray-400 text-sm mb-6">{t('landingPage.bento.skillDesc')}</p>

                    {/* Mini stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-2xl font-black text-cyan-400"><StatsCounter value={87} suffix="%" /></div>
                        <div className="text-xs text-gray-500">{t('landingPage.bento.csAccuracy')}</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-2xl font-black text-purple-400"><StatsCounter value={142} /></div>
                        <div className="text-xs text-gray-500">{t('landingPage.bento.visionScore')}</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-2xl font-black text-amber-400"><StatsCounter value={24} suffix="K" /></div>
                        <div className="text-xs text-gray-500">{t('landingPage.bento.totalDamage')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Win Rate Card */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-6 md:col-span-4"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors flex flex-col justify-center items-center"
                glowColor="emerald"
              >
                <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2">Win Rate</div>
                <div className="text-5xl md:text-6xl font-black text-white mb-2">
                  <StatsCounter value={67} suffix="%" />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm">
                  <LuTrendingUp className="text-lg" />
                  <span>{t('landingPage.bento.winRateChange')}</span>
                </div>
              </TiltCard>
            </motion.div>

            {/* AI Chat Preview */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-6 md:col-span-4"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-5 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors"
                glowColor="amber"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-black">
                    AI
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t('landingPage.bento.aiCoachLabel')}</div>
                    <div className="text-xs text-gray-500">{t('landingPage.bento.activeNow')}</div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="bg-white/5 rounded-lg p-3 text-gray-300">
                    {t('landingPage.bento.aiChatPreview')}
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Feature Card 1 */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-12 md:col-span-4"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-colors"
                glowColor="purple"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl text-purple-400 mb-4">
                  <LuSwords />
                </div>
                <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.matchupTitle')}</h3>
                <p className="text-gray-400 text-sm">
                  {t('landingPage.bento.matchupDesc')}
                </p>
              </TiltCard>
            </motion.div>

            {/* Feature Card 2 */}
            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-6 md:col-span-4"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors"
                glowColor="cyan"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-2xl text-cyan-400 mb-4">
                  <LuTarget />
                </div>
                <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.macroTitle')}</h3>
                <p className="text-gray-400 text-sm">
                  {t('landingPage.bento.macroDesc')}
                </p>
              </TiltCard>
            </motion.div>

            {/* Feature Card 3 */}
            <motion.div
              custom={5}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariants}
              className="col-span-6 md:col-span-4"
            >
              <TiltCard
                className="h-full bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-6 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors"
                glowColor="amber"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl text-amber-400 mb-4">
                  <LuZap />
                </div>
                <h3 className="text-lg font-bold mb-2">{t('landingPage.bento.microTitle')}</h3>
                <p className="text-gray-400 text-sm">
                  {t('landingPage.bento.microDesc')}
                </p>
              </TiltCard>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
          </motion.div>
        </motion.div>
      </header>

      {/* Features Detail Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <span className="text-cyan-400 font-bold uppercase tracking-widest text-sm">Features</span>
            <h2 className="text-4xl md:text-5xl font-black mt-4 mb-6">
              {t('landingPage.features.sectionTitlePrefix')}<span className="text-cyan-400">{t('landingPage.features.sectionTitle')}</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {t('landingPage.features.sectionDesc')}
            </p>
          </motion.div>

          {/* Large Feature Cards */}
          <div className="space-y-8">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div className="bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-8 rounded-2xl border border-white/5">
                <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-6xl text-cyan-400/50">
                    <LuChartBar />
                  </div>
                </div>
              </div>
              <div>
                <span className="text-cyan-400 font-bold text-sm uppercase tracking-wider">01</span>
                <h3 className="text-3xl font-bold mt-2 mb-4">{t('landingPage.features.statsTitle')}</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  {t('landingPage.features.statsDesc')}
                </p>
                <ul className="space-y-2 text-sm">
                  {[t('landingPage.features.statsFeature1'), t('landingPage.features.statsFeature2'), t('landingPage.features.statsFeature3')].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="grid md:grid-cols-2 gap-8 items-center"
            >
              <div className="md:order-2 bg-gradient-to-br from-[#0f0f15] to-[#0a0a0f] p-8 rounded-2xl border border-white/5">
                <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
                  <div className="text-6xl text-purple-400/50">
                    <LuMessageCircle />
                  </div>
                </div>
              </div>
              <div className="md:order-1">
                <span className="text-purple-400 font-bold text-sm uppercase tracking-wider">02</span>
                <h3 className="text-3xl font-bold mt-2 mb-4">{t('landingPage.features.chatTitle')}</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  {t('landingPage.features.chatDesc')}
                </p>
                <ul className="space-y-2 text-sm">
                  {[t('landingPage.features.chatFeature1'), t('landingPage.features.chatFeature2'), t('landingPage.features.chatFeature3')].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[200px]"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              {t('landingPage.cta.titlePrefix')}<span className="text-cyan-400">{t('landingPage.cta.title')}</span>{t('landingPage.cta.titleEnd')}
            </h2>
            <p className="text-gray-400 mb-10 max-w-xl mx-auto">
              {t('landingPage.cta.desc')}
            </p>
            <MagneticButton
              href="/signup"
              className="inline-block px-12 py-5 text-xl font-bold bg-white text-black rounded-lg hover:bg-gray-100 transition shadow-2xl shadow-white/10"
            >
              {t('landingPage.cta.button')}
            </MagneticButton>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span>{t('landingPage.cta.trustRiot')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full" />
                <span>{t('landingPage.cta.trustNoCc')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full" />
                <span>{t('landingPage.cta.trustJa')}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
