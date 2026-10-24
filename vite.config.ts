import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" damit die App auch unter github.io/pazulic/ läuft.
export default defineConfig({ plugins: [react()], base: "./" });
