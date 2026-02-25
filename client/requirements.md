## Packages
framer-motion | Essential for premium scroll animations, staggered reveals, and interactive micro-interactions.
react-intersection-observer | Useful for triggering animations when elements scroll into view (though framer-motion's whileInView often suffices, it's good for complex cases).
clsx | Utility for constructing className strings conditionally.
tailwind-merge | Utility to merge tailwind classes without style conflicts.

## Notes
- Tailwind Config - needs extending fontFamily in `tailwind.config.ts` to include `display: ["var(--font-display)"]` and `sans: ["var(--font-sans)"]`.
- Assumes standard Shadcn UI components are available at `@/components/ui/*`.
- Dark mode is forced/default for this premium nightlife aesthetic.
