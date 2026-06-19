#!/usr/bin/env node

import { spawn } from "child_process";

spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});