/**
 * Ambient declaration for side-effect CSS imports from node_modules.
 *
 * Next.js + Turbopack handle these at build time, but strict TypeScript
 * needs a module shape. Declaring an empty module makes the import
 * legal without giving it any runtime surface.
 */
declare module '*.css';
