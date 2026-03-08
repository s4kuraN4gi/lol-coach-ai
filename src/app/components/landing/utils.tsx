"use client";

import Link from "next/link";
import { useRef, useState, useEffect, MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// ============================================================
// ANIMATION VARIANTS
// ============================================================

export const fadeUpVariants = {
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

export const glowPulse = {
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

// Magnetic Button Component — uses Next.js Link for SPA routing
export function MagneticButton({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
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
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY, display: "inline-block" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.div>
  );
}

// 3D Tilt Card Component
export function TiltCard({ children, className, glowColor = "cyan" }: { children: React.ReactNode; className?: string; glowColor?: string }) {
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

// Typing Effect Component
export function TypingText({ text, className }: { text: string; className?: string }) {
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
export function StatsCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
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
