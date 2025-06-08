const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const openTofuRoutes = require('./routes/opentofu');
const catalogRoutes = require('./routes/catalog');
const templateRoutes = require('./routes/template');
const StartupService = require('./services/StartupService');

app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(express.json());
app.use('/api', openTofuRoutes);
app.use('/api', catalogRoutes);
app.use('/api', templateRoutes);

const hostname = '0.0.0.0';
const port = process.env.PORT || 8000;
const bucketName = process.env.S3_BUCKET;

// Start server with plan loops initialization
const server = app.listen(port, hostname, () => {
    console.log(`✅ Server started on http://${hostname}:${port}`);

    // Initialize plan loops for all existing services after a short delay
    setTimeout(async () => {
        try {
            console.log('🔄 Initializing plan loops for all existing services...');
            const summary = await StartupService.initializeAllPlanLoops(bucketName);

            console.log(`🚀 Plan loops initialization complete:`);
            console.log(`   • Clients processed: ${summary.clientsProcessed}`);
            console.log(`   • Services started: ${summary.servicesStarted}`);
            console.log(`   • Errors: ${summary.errors.length}`);

            if (summary.errors.length > 0) {
                console.log('⚠️  Some services failed to start:');
                summary.errors.forEach(error => console.log(`   - ${error}`));
            }
        } catch (err) {
            console.error('❌ Failed to initialize plan loops:', err.message);
            // Don't crash the server, just log the error
        }
    }, 3000); // 3 second delay to ensure everything is ready
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);

    try {
        // Stop all plan loops first
        StartupService.stopAllPlanLoops();
        console.log('✅ All plan loops stopped');
    } catch (err) {
        console.error('⚠️  Error stopping plan loops:', err.message);
    }

    // Close HTTP server
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds if server doesn't close
    setTimeout(() => {
        console.log('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

// Handle shutdown signals (Ctrl+C, Docker stop, etc.)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});