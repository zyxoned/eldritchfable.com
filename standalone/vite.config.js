import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const proxy = { '/api': process.env.ELDRITCH_DEV_API || 'http://127.0.0.1:3000' };
export default defineConfig({ plugins: [react()], server: { proxy }, preview: { proxy } });
