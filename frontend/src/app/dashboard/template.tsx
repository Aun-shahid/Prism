'use client';

import * as React from 'react';
import { m } from 'motion/react';

/** Remounts on each dashboard navigation → subtle fade-up page transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}
