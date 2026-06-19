#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

spawn(
  "npm",
  ["run", "dev"],
  {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  }
);