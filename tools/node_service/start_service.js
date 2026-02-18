/**
 * Start script for PDF Generation Service
 * Loads environment variables and starts the Express server
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('[PDF Service] Loading environment from:', envPath);

  // Simple .env parser (no dependency on dotenv package)
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} else {
  console.warn('[PDF Service] Warning: .env file not found at:', envPath);
  console.warn('[PDF Service] Using default environment variables');
}

// Start the service
require('./pdf_service');
