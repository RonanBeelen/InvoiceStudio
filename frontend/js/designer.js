/**
 * Template Designer Logic
 * Handles pdfme Designer initialization and template saving
 */

let designer = null;
let currentTemplateId = null;
let isEditMode = false;

// Default blank template structure for pdfme
const DEFAULT_TEMPLATE = {
    basePdf: {
        width: 210,  // A4 width in mm
        height: 297, // A4 height in mm
        padding: [10, 10, 10, 10]
    },
    schemas: [[]]  // Empty schema array - user will add fields
};

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

/**
 * Initialize pdfme Designer
 */
async function initDesigner(template = null) {
    const container = document.getElementById('designer');
    const loading = document.getElementById('loading');

    try {
        // Use provided template or default
        const designTemplate = template || DEFAULT_TEMPLATE;

        // Wait for pdfme libraries to load
        if (typeof pdfmeUI === 'undefined') {
            throw new Error('pdfme libraries not loaded. Check CDN links.');
        }

        // Get schemas from pdfme
        const schemas = pdfmeSchemas;

        // Initialize pdfme Designer
        designer = new pdfmeUI.Designer({
            domContainer: container,
            template: designTemplate,
            schemas: [
                schemas.text,
                schemas.image,
                schemas.qrcode,
                schemas.barcodes,
                schemas.rectangle,
                schemas.line,
                schemas.ellipse
            ]
        });

        // Hide loading, show designer
        loading.style.display = 'none';
        container.style.display = 'block';

        console.log('Designer initialized successfully');
    } catch (error) {
        console.error('Failed to initialize designer:', error);
        showNotification('Fout bij laden van designer: ' + error.message, 'error');
        loading.innerHTML = `
            <p style="color: #721c24;">❌ Fout bij laden</p>
            <p style="font-size: 14px; color: #666;">${error.message}</p>
        `;
    }
}

/**
 * Load template from backend (for editing)
 */
async function loadTemplate(templateId) {
    try {
        showNotification('Template laden...', 'info');

        const template = await api.getTemplate(templateId);

        // Populate form
        document.getElementById('template-name').value = template.name || '';
        document.getElementById('page-title').textContent = '✏️ Template Bewerken';

        // Set edit mode
        currentTemplateId = templateId;
        isEditMode = true;

        // Initialize designer with loaded template
        await initDesigner(template.template_json);

        showNotification('Template geladen!', 'success');
    } catch (error) {
        console.error('Failed to load template:', error);
        showNotification('Fout bij laden van template: ' + error.message, 'error');

        // Fall back to blank template
        await initDesigner();
    }
}

/**
 * Save template (create or update)
 */
async function saveTemplate() {
    const saveBtn = document.getElementById('save-btn');
    const nameInput = document.getElementById('template-name');

    // Validate template name
    const name = nameInput.value.trim();
    if (!name) {
        showNotification('Vul een template naam in', 'error');
        nameInput.focus();
        return;
    }

    // Get current template from designer
    const template = designer.getTemplate();

    // Validate that template has fields
    if (!template.schemas || !template.schemas[0] || template.schemas[0].length === 0) {
        const confirm = window.confirm(
            'Je template heeft nog geen velden. Wil je toch opslaan?'
        );
        if (!confirm) return;
    }

    // Disable save button during save
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 Opslaan...';

    try {
        const templateData = {
            name: name,
            description: '', // Can add description field later
            template_json: template
        };

        let result;
        if (isEditMode && currentTemplateId) {
            // Update existing template
            result = await api.updateTemplate(currentTemplateId, templateData);
            showNotification('✓ Template bijgewerkt!', 'success');
        } else {
            // Create new template
            result = await api.createTemplate(templateData);
            showNotification('✓ Template opgeslagen!', 'success');

            // Switch to edit mode with the new template ID
            currentTemplateId = result.id;
            isEditMode = true;
            document.getElementById('page-title').textContent = '✏️ Template Bewerken';

            // Update URL without reload
            const newUrl = `/designer?template_id=${result.id}`;
            window.history.pushState({ templateId: result.id }, '', newUrl);
        }

        console.log('Template saved:', result);
    } catch (error) {
        console.error('Failed to save template:', error);
        showNotification('❌ Fout bij opslaan: ' + error.message, 'error');
    } finally {
        // Re-enable save button
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Opslaan';
    }
}

/**
 * Initialize page
 */
async function init() {
    // Check if we're editing an existing template
    const urlParams = new URLSearchParams(window.location.search);
    const templateId = urlParams.get('template_id');

    if (templateId) {
        await loadTemplate(templateId);
    } else {
        // New template - initialize with blank
        await initDesigner();
    }

    // Setup save button
    document.getElementById('save-btn').addEventListener('click', saveTemplate);

    // Auto-save on Ctrl+S
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveTemplate();
        }
    });
}

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
