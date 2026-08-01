// 从 .env 加载密钥（.env 已被 gitignore，不会泄露）
const dotenv = require("dotenv")
const env = dotenv.config()?.parsed || {}

module.exports = {
  apps: [{
    name: "i面试",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3000",
    cwd: __dirname,
    env: {
      ...env,
      NODE_ENV: "production",
    },
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "500M",
    error_file: "logs/error.log",
    out_file: "logs/output.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }]
}
