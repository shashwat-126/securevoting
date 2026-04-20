module.exports = {
  apps: [
    {
      name: "secure-voting",
      script: "server.js",
      instances: "max",          // Use all CPU cores (cluster mode)
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "500M",
      env_production: {
        NODE_ENV: "production",
      },
      // Logging
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
