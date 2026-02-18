/**
 * PDF Generation Service using pdfme
 * Express API that wraps pdfme/generator for PDF creation
 */

const express = require('express');
const cors = require('cors');
const { generate } = require('@pdfme/generator');
const {
  text: _text,
  image: _image,
  barcodes: _barcodes,
  line: _line,
  rectangle: _rectangle,
  ellipse: _ellipse,
  svg: _svg,
  table: _table,
  multiVariableText: _multiVariableText
} = require('@pdfme/schemas');

// pdfme v4.5.2 requires 'name' in each plugin's propPanel.defaultSchema
function patchPlugin(plugin, name) {
  const patched = { ...plugin };
  if (patched.propPanel?.defaultSchema && !patched.propPanel.defaultSchema.name) {
    patched.propPanel = {
      ...patched.propPanel,
      defaultSchema: { ...patched.propPanel.defaultSchema, name }
    };
  }
  return patched;
}

const text = patchPlugin(_text, 'text');
const image = patchPlugin(_image, 'image');
const line = patchPlugin(_line, 'line');
const rectangle = patchPlugin(_rectangle, 'rectangle');
const ellipse = patchPlugin(_ellipse, 'ellipse');
const svg = patchPlugin(_svg, 'svg');
const table = patchPlugin(_table, 'table');
const multiVariableText = patchPlugin(_multiVariableText, 'multiVariableText');
const barcodes = Object.fromEntries(
  Object.entries(_barcodes).map(([k, v]) => [k, patchPlugin(v, k)])
);

const app = express();
const PORT = process.env.NODE_SERVICE_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large template JSONs
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'pdf-generator',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Generate PDF endpoint
 *
 * Request body:
 * {
 *   template: { basePdf: ..., schemas: [...] },
 *   inputs: [{ field1: value1, field2: value2, ... }]
 * }
 *
 * Response:
 * - Success: PDF buffer as base64 string
 * - Error: JSON with error message
 */
app.post('/generate', async (req, res) => {
  try {
    const { template, inputs } = req.body;

    // Validate request
    if (!template) {
      return res.status(400).json({
        error: 'Missing required field: template'
      });
    }

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid field: inputs (must be non-empty array)'
      });
    }

    // Validate template structure
    if (!template.schemas || !Array.isArray(template.schemas)) {
      return res.status(400).json({
        error: 'Invalid template: missing schemas array'
      });
    }

    const fieldCount = Array.isArray(template.schemas[0])
      ? template.schemas[0].length
      : Object.keys(template.schemas[0] || {}).length;

    console.log('[PDF Service] Generating PDF...');
    console.log(`[PDF Service] Template has ${fieldCount} fields`);
    console.log(`[PDF Service] Processing ${inputs.length} input(s)`);

    // Generate PDF using pdfme with plugins for rendering schema types
    const pdf = await generate({
      template,
      inputs,
      plugins: { text, image, line, rectangle, ellipse, svg, table, multiVariableText, ...barcodes }
    });

    console.log('[PDF Service] PDF generated successfully');

    // Convert PDF buffer to base64
    const base64Pdf = Buffer.from(pdf).toString('base64');

    res.json({
      success: true,
      pdf: base64Pdf,
      size: pdf.byteLength,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[PDF Service] Error generating PDF:', error);

    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message,
      details: process.env.DEBUG === 'true' ? error.stack : undefined
    });
  }
});

/**
 * Preview endpoint - generates a PDF preview with placeholder data
 *
 * Request body:
 * {
 *   template: { basePdf: ..., schemas: [...] }
 * }
 */
app.post('/preview', async (req, res) => {
  try {
    const { template } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Missing required field: template' });
    }

    if (!template.schemas || !Array.isArray(template.schemas)) {
      return res.status(400).json({ error: 'Invalid template: missing schemas array' });
    }

    // 1x1 transparent PNG as placeholder for empty image fields
    const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    // For preview: make a deep copy of the template and set ALL fields to readOnly
    // so pdfme renders their content directly instead of treating them as empty input fields
    const previewTemplate = JSON.parse(JSON.stringify(template));
    const pageSchema = previewTemplate.schemas[0] || {};
    const placeholderInputs = {};

    if (!Array.isArray(pageSchema)) {
      for (const [fieldName, fieldDef] of Object.entries(pageSchema)) {
        const type = fieldDef.type || 'text';
        const content = (fieldDef.content || '').trim();

        // Set readOnly so pdfme renders the content in the PDF
        fieldDef.readOnly = true;

        if (type === 'text' || type === 'multiVariableText') {
          if (!content) fieldDef.content = fieldName;
          placeholderInputs[fieldName] = fieldDef.content;
        } else if (type === 'image') {
          if (!content) fieldDef.content = PLACEHOLDER_IMAGE;
          placeholderInputs[fieldName] = fieldDef.content;
        } else {
          if (!content) fieldDef.content = fieldName;
          placeholderInputs[fieldName] = fieldDef.content;
        }
      }
    } else {
      for (const field of pageSchema) {
        const name = field.name || 'unnamed';
        field.readOnly = true;
        if (!field.content) field.content = name;
        placeholderInputs[name] = field.content;
      }
    }

    console.log('[PDF Service] Generating preview...');

    const pdf = await generate({
      template: previewTemplate,
      inputs: [placeholderInputs],
      plugins: { text, image, line, rectangle, ellipse, svg, table, multiVariableText, ...barcodes }
    });

    console.log('[PDF Service] Preview generated successfully');

    const base64Pdf = Buffer.from(pdf).toString('base64');

    res.json({
      success: true,
      pdf: base64Pdf,
      size: pdf.byteLength
    });

  } catch (error) {
    console.error('[PDF Service] Error generating preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message
    });
  }
});

/**
 * Info endpoint
 */
app.get('/info', (req, res) => {
  res.json({
    service: 'PDF Generation Microservice',
    description: 'Generates PDFs using pdfme library',
    endpoints: {
      health: 'GET /health',
      generate: 'POST /generate',
      preview: 'POST /preview',
      info: 'GET /info'
    },
    dependencies: {
      pdfme: require('@pdfme/generator/package.json').version,
      express: require('express/package.json').version
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('[PDF Service] Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log('PDF Generation Service Started');
  console.log(`${'='.repeat(50)}`);
  console.log(`Port: ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Generate: POST http://localhost:${PORT}/generate`);
  console.log(`${'='.repeat(50)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[PDF Service] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[PDF Service] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[PDF Service] SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('[PDF Service] Server closed');
    process.exit(0);
  });
});

module.exports = app;
