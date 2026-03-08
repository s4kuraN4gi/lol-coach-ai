"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Floating Particles Component (uses fixed positions to avoid hydration mismatch)
export function FloatingParticles() {
  const [mounted, setMounted] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(pointer: coarse)").matches) {
      setIsTouchDevice(true);
    }
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

  if (!mounted || isTouchDevice) return null;

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
export function GridBackground() {
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
export function MouseFollowGlow() {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Skip on touch devices (mobile/tablet) to save performance
    if (window.matchMedia("(pointer: coarse)").matches) {
      setIsTouchDevice(true);
      return;
    }
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!mounted || isTouchDevice) return null;

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
