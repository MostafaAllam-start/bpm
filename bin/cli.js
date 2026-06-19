#!/usr/bin/env node

const { spawn } = require("child_process");

spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});