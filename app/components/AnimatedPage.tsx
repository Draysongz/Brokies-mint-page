"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function AnimatedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export { motion, AnimatePresence };
