# Design System Documentation

## Overview

This design system ensures visual consistency across all pages of the OpenCanvas PDF Builder application. All components, colors, typography, and spacing follow these guidelines.

---

## Color Palette

### Primary Darks
Used for backgrounds, sidebars, headers, and selected states.

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| **Rich Black** | `#001A1A` | `--color-rich-black` | Primary text, dark backgrounds |
| **Dark Green** | `#003D33` | `--color-dark-green` | Sidebars, selected menu states, headers |

### Accent & Highlights
Used for buttons, progress bars, data visualization, and interactive elements.

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| **Shamrock Green** | `#008F7A` | `--color-shamrock` | Primary buttons, accents |
| **Mountain Meadow** | `#1AB291` | `--color-mountain-meadow` | Hover states, progress indicators |
| **Caribbean Green** | `#4DDFB5` | `--color-caribbean` | Highlights, success states |

### Backgrounds & Text
Used for main content areas and typography.

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| **White** | `#FFFFFF` | `--color-white` | Main content background, cards |
| **Light Gray** | `#F5F5F5` | `--color-background` | Page background |
| **Text Primary** | `#001A1A` | `--color-text-primary` | Primary text (Rich Black) |
| **Text Secondary** | `#666666` | `--color-text-secondary` | Secondary text, labels |

### Utility Colors

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| **Success** | `#4DDFB5` | `--color-success` | Success messages, confirmations |
| **Error** | `#E53E3E` | `--color-error` | Error messages, warnings |
| **Info** | `#1AB291` | `--color-info` | Info messages, tips |

### Color Usage Examples

```css
/* Header with dark background */
.header {
  background: var(--color-dark-green);
  color: var(--color-white);
}

/* Primary button */
.btn-primary {
  background: var(--color-shamrock);
  color: var(--color-white);
}

.btn-primary:hover {
  background: var(--color-mountain-meadow);
}

/* Card on page */
.card {
  background: var(--color-white);
  color: var(--color-text-primary);
}
```

---

## Typography

### Font Family

**Primary Font:** System font stack for maximum compatibility and performance

```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```

This stack provides:
- Native look and feel on each platform
- Optimal rendering performance
- Excellent readability

### Font Weights

| Weight Name | Value | CSS Variable | Usage |
|------------|-------|--------------|-------|
| **Regular** | 400 | `--font-weight-regular` | Body text, paragraphs |
| **Medium** | 500 | `--font-weight-medium` | Labels, subheadings |
| **Semi Bold** | 600 | `--font-weight-semibold` | Headings, buttons, emphasis |

### Font Size Scale

| Size Name | Value | Line Height | Usage |
|-----------|-------|-------------|-------|
| **Extra Small** | 12px | 16px | Small labels, captions |
| **Small** | 14px | 20px | Body text, form inputs |
| **Base** | 16px | 24px | Default body text |
| **Large** | 18px | 28px | Subheadings |
| **XL** | 24px | 32px | Page headings (h2) |
| **2XL** | 32px | 40px | Main headings (h1) |

### Typography Examples

```css
/* Page heading */
h1 {
  font-size: 32px;
  font-weight: var(--font-weight-semibold);
  line-height: 40px;
  color: var(--color-text-primary);
}

/* Section heading */
h2 {
  font-size: 24px;
  font-weight: var(--font-weight-semibold);
  line-height: 32px;
  color: var(--color-text-primary);
}

/* Body text */
p {
  font-size: 16px;
  font-weight: var(--font-weight-regular);
  line-height: 24px;
  color: var(--color-text-primary);
}

/* Label */
label {
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}
```

---

## Spacing System

Based on an 8px grid system for consistent alignment and visual rhythm.

### Spacing Scale

| Size | Value | CSS Variable | Usage |
|------|-------|--------------|-------|
| **XS** | 4px | `--space-xs` | Tight spacing, icon gaps |
| **SM** | 8px | `--space-sm` | Small gaps, compact layouts |
| **MD** | 16px | `--space-md` | Default spacing between elements |
| **LG** | 24px | `--space-lg` | Section spacing |
| **XL** | 32px | `--space-xl` | Large section spacing |
| **2XL** | 48px | `--space-2xl` | Page margins, major sections |

### Spacing Usage

```css
/* Card padding */
.card {
  padding: var(--space-lg); /* 24px */
}

/* Form group spacing */
.form-group {
  margin-bottom: var(--space-md); /* 16px */
}

/* Button padding */
.btn {
  padding: var(--space-sm) var(--space-md); /* 8px 16px */
}

/* Page container */
.container {
  padding: var(--space-xl); /* 32px */
}
```

---

## Border Radius

Consistent corner rounding for visual harmony.

| Size | Value | CSS Variable | Usage |
|------|-------|--------------|-------|
| **SM** | 4px | `--radius-sm` | Small elements, badges |
| **MD** | 6px | `--radius-md` | Buttons, inputs |
| **LG** | 8px | `--radius-lg` | Cards, containers |
| **XL** | 12px | `--radius-xl` | Large cards, modals |

---

## Shadows

Elevation system for creating visual hierarchy.

| Level | Value | CSS Variable | Usage |
|-------|-------|--------------|-------|
| **SM** | `0 1px 2px rgba(0,0,0,0.05)` | `--shadow-sm` | Subtle elevation |
| **MD** | `0 2px 8px rgba(0,0,0,0.1)` | `--shadow-md` | Cards, dropdowns |
| **LG** | `0 4px 12px rgba(0,0,0,0.15)` | `--shadow-lg` | Modals, popovers |

---

## Transitions

Consistent animation timing for smooth interactions.

| Speed | Duration | CSS Variable | Usage |
|-------|----------|--------------|-------|
| **Fast** | 150ms | `--transition-fast` | Hover effects |
| **Base** | 250ms | `--transition-base` | Default transitions |
| **Slow** | 350ms | `--transition-slow` | Complex animations |

```css
/* Button hover effect */
.btn {
  transition: all var(--transition-fast);
}

/* Card expansion */
.card {
  transition: transform var(--transition-base);
}
```

---

## Iconography

### Style Guidelines

- **Style:** Minimalist, clean line-art
- **Corners:** Rounded (not sharp angles)
- **Stroke Width:** 2px for consistency
- **Style:** Outline/line icons (not filled)

### Size Standards

| Size Name | Dimensions | Usage |
|-----------|------------|-------|
| **Small** | 16x16px | Inline icons, badges |
| **Medium** | 24x24px | Buttons, menu items |
| **Large** | 32x32px | Feature icons, empty states |
| **XL** | 48x48px | Hero icons, illustrations |

### Recommended Icon Sets

1. **Feather Icons** - https://feathericons.com/
   - Minimalist design
   - Consistent stroke width
   - Rounded corners
   - Open source

2. **Lucide Icons** - https://lucide.dev/
   - Fork of Feather with more icons
   - Same style consistency
   - Modern and clean

### Icon Usage Example

```html
<!-- Dashboard icon (24x24) -->
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="7" height="7"></rect>
  <rect x="14" y="3" width="7" height="7"></rect>
  <rect x="14" y="14" width="7" height="7"></rect>
  <rect x="3" y="14" width="7" height="7"></rect>
</svg>
```

---

## Components

### Buttons

#### Primary Button
Used for main actions (save, submit, generate).

```css
.btn-primary {
  background: var(--color-shamrock);
  color: var(--color-white);
  border: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-mountain-meadow);
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### Secondary Button
Used for secondary actions (cancel, back).

```css
.btn-secondary {
  background: var(--color-background);
  color: var(--color-text-primary);
  border: 2px solid var(--color-dark-green);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-dark-green);
  color: var(--color-white);
}
```

---

### Forms

#### Form Group
Container for label + input.

```css
.form-group {
  margin-bottom: var(--space-md);
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.form-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 2px solid #e0e0e0;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: var(--font-family);
  transition: border-color var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-shamrock);
}

.form-input:invalid {
  border-color: var(--color-error);
}
```

---

### Cards

```css
.card {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-base);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

---

### Header

```css
.header {
  background: var(--color-dark-green);
  color: var(--color-white);
  padding: var(--space-md) var(--space-xl);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-md);
}

.header-title {
  font-size: 24px;
  font-weight: var(--font-weight-semibold);
}
```

---

### Notifications

```css
.notification {
  position: fixed;
  top: 80px;
  right: 30px;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 14px;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.notification-success {
  background: #d4edda;
  color: #155724;
}

.notification-error {
  background: #f8d7da;
  color: #721c24;
}

.notification-info {
  background: #d1ecf1;
  color: #0c5460;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

---

### Loading Spinner

```css
.spinner {
  border: 4px solid var(--color-background);
  border-top: 4px solid var(--color-shamrock);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

### Selected Menu State

Special component for active navigation items with organic flowing effect.

```css
.menu-item {
  padding: var(--space-md) var(--space-lg);
  color: var(--color-text-secondary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  transition: all var(--transition-fast);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.menu-item:hover {
  background: rgba(0, 61, 51, 0.1);
  color: var(--color-dark-green);
}

.menu-item-selected {
  background: var(--color-dark-green);
  color: var(--color-white);
  font-weight: var(--font-weight-semibold);
  position: relative;
}

/* Organic flowing effect extending into content area */
.menu-item-selected::after {
  content: '';
  position: absolute;
  right: -20px;
  top: 0;
  height: 100%;
  width: 20px;
  background: var(--color-dark-green);
  clip-path: polygon(0 0, 100% 25%, 100% 75%, 0 100%);
}
```

**Visual Description:**
The selected menu item has a dark green background (#003D33) that smoothly flows into the main content area using a curved/organic shape created with `clip-path`. This creates visual depth and a sense of continuity between the sidebar and content.

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| **Mobile** | < 768px | Single column layouts |
| **Tablet** | 768px - 1024px | Two column layouts |
| **Desktop** | > 1024px | Multi-column layouts |

### Responsive Example

```css
/* Mobile first approach */
.container {
  padding: var(--space-md);
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: var(--space-lg);
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: var(--space-xl);
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

---

## Accessibility

### Color Contrast
- All text meets WCAG AA standards (4.5:1 contrast ratio minimum)
- Interactive elements have clear focus states
- Color is never the only indicator (use icons + text)

### Focus States

```css
/* Keyboard focus indicator */
*:focus-visible {
  outline: 2px solid var(--color-shamrock);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### Screen Reader Support

```html
<!-- Button with accessible label -->
<button class="btn-primary" aria-label="Save template">
  <svg>...</svg>
  Save
</button>

<!-- Form input with proper labeling -->
<div class="form-group">
  <label for="template-name">Template Name</label>
  <input
    id="template-name"
    name="templateName"
    class="form-input"
    aria-required="true"
  />
</div>
```

---

## Implementation Notes

### CSS Variable Usage

Always use CSS variables for colors, spacing, and other design tokens:

```css
/* ✅ Good - uses design system */
.my-component {
  background: var(--color-white);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

/* ❌ Bad - hardcoded values */
.my-component {
  background: #FFFFFF;
  padding: 16px;
  border-radius: 6px;
}
```

### Class Naming Convention

Use BEM-inspired naming for clarity:

```css
/* Block */
.card { }

/* Block modifier */
.card--highlighted { }

/* Element */
.card__title { }

/* Element modifier */
.card__title--large { }
```

---

## Quick Reference

### Most Common Patterns

```css
/* Standard button */
.btn-primary {
  background: var(--color-shamrock);
  color: var(--color-white);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
}

/* Standard card */
.card {
  background: var(--color-white);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

/* Standard form input */
.form-input {
  padding: var(--space-sm) var(--space-md);
  border: 2px solid #e0e0e0;
  border-radius: var(--radius-md);
}

/* Standard header */
.header {
  background: var(--color-dark-green);
  color: var(--color-white);
  padding: var(--space-md) var(--space-xl);
}
```

---

## Changelog

### Version 1.0.0 (Current)
- Initial design system documentation
- Defined color palette (Rich Black, Dark Green, Shamrock Green, etc.)
- Typography system with three weights
- Spacing scale based on 8px grid
- Component specifications
- Selected menu state with organic flow effect

---

## Resources

- **Icon Set:** Feather Icons (https://feathericons.com/) or Lucide (https://lucide.dev/)
- **Font Stack:** System fonts for optimal performance
- **Color Tool:** Use browser DevTools to test contrast ratios
- **CSS Variables:** MDN Web Docs - https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties

---

**Last Updated:** 2026-02-06
**Maintained By:** OpenCanvas Team
