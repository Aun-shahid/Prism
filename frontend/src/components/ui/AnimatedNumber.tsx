'use client';

import * as React from 'react';
import { m, useReducedMotion, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
}

const defaultFormat = (n: number) => n.toLocaleString();

/** Count-up number driven by a motion spring; jumps instantly under reduced motion. */
export default function AnimatedNumber({ value, format = defaultFormat }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 24 });
  const display = useTransform(spring, (v) => format(Math.round(v)));

  React.useEffect(() => {
    if (reduced) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [value, reduced, spring]);

  return <m.span>{display}</m.span>;
}
