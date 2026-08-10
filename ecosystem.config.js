module.exports = {
  apps: [
    {
      name: "taskmentor-server",
      cwd: "/opt/apps/nga-task-mentor/server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "taskmentor-live",
      cwd: "/opt/apps/nga-task-mentor/live-server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
