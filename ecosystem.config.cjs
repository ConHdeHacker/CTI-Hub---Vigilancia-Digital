module.exports = {
  apps: [
    {
      name: 'vigilancia-cti',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--no-warnings',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
