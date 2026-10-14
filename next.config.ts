import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dictionnaire du Scrabble (≈ 730 Ko compressé), lu au démarrage par lib/games/scrabble-dico.ts.
  outputFileTracingIncludes: {
    "/**": ["./data/scrabble/mots.txt.gz"],
  },
};

export default nextConfig;
