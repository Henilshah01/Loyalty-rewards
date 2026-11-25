
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const startServer = async () => {
  try {
    // 1. Load environment configuration
    const cfg = loadConfig();

    // 2. Connect to MongoDB
    await mongoose.connect(cfg.mongoUri);
    console.log('MongoDB connected successfully');

    // 3. Create Express application
    const app = createApp(cfg);

    // 4. Start backend server
    const server = app.listen(cfg.port, () => {
      console.log(`API listening on http://localhost:${cfg.port}`);
    });

    // 5. Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server...');

      server.close(async () => {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Server startup failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

startServer();
