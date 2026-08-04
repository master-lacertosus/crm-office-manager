import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler: memoizza in automatico componenti e valori derivati,
  // eliminando i re-render a cascata dei consumer dello store.
  reactCompiler: true,
  experimental: {
    // Variante Rust nativa in Turbopack (Next 16.3): niente plugin Babel.
    turbopackRustReactCompiler: true,
    // Il barrel `radix-ui` (Slot, Label, Separator…) si carica a moduli
    // singoli invece che per intero.
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
