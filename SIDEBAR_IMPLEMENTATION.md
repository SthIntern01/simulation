# 🎯 Sidebar Implementation Guide

## Current Status

✅ **Dashboard.html** - Has complete sidebar with navigation
✅ **Campaigns.html** - Has complete sidebar with navigation

⏳ **Remaining pages need sidebar:**
- templates.html
- users.html
- analytics.html
- reports.html
- training.html
- settings.html

## Complete Sidebar Code

### 1. CSS to Add (in `<style>` section)

```css
/* Sidebar Styles - Add after body styles */
.sidebar { 
    position: fixed; 
    left: 0; 
    top: 0; 
    width: 260px; 
    height: 100vh; 
    background: linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%); 
    color: white; 
    padding: 2rem 0; 
    z-index: 1000; 
    box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1); 
    overflow-y: auto; 
}

.logo-section { 
    padding: 0 1.5rem 2rem; 
    border-bottom: 1px solid rgba(255, 255, 255, 0.1); 
    margin-bottom: 1.5rem; 
}

.logo { 
    display: flex; 
    align-items: center; 
    gap: 0.75rem; 
    font-size: 1.3rem; 
    font-weight: 700; 
}

.logo i { 
    font-size: 1.8rem; 
    color: #60a5fa; 
}

.subtitle { 
    font-size: 0.75rem; 
    color: #93c5fd; 
    margin-top: 0.25rem; 
    margin-left: 2.5rem; 
}

.nav-menu { 
    list-style: none; 
}

.nav-item { 
    margin-bottom: 0.5rem; 
}

.nav-link { 
    display: flex; 
    align-items: center; 
    gap: 0.75rem; 
    padding: 0.875rem 1.5rem; 
    color: #e0e7ff; 
    text-decoration: none; 
    transition: all 0.3s ease; 
    border-left: 3px solid transparent; 
}

.nav-link:hover { 
    background: rgba(255, 255, 255, 0.1); 
    color: white; 
    border-left-color: #60a5fa; 
}

.nav-link.active { 
    background: rgba(96, 165, 250, 0.2); 
    color: white; 
    border-left-color: #60a5fa; 
}

.nav-link i { 
    width: 20px; 
    text-align: center; 
}

/* Update container to account for sidebar */
.container { 
    margin-left: 260px; 
    /* rest of your container styles */ 
}

/* Responsive */
@media (max-width: 1024px) {
    .sidebar { 
        transform: translateX(-100%); 
        transition: transform 0.3s; 
    }
    .sidebar.active { 
        transform: translateX(0); 
    }
    .container { 
        margin-left: 0; 
    }
}
```

### 2. HTML to Add (after `<body>` tag)

```html
<!-- Sidebar -->
<aside class="sidebar" id="sidebar">
    <div class="logo-section">
        <div class="logo">
            <i class="fa-solid fa-shield-halved"></i>
            <span>SandBox Security</span>
        </div>
        <div class="subtitle">Phishing Simulation Platform</div>
    </div>
    <ul class="nav-menu">
        <li class="nav-item">
            <a class="nav-link" href="dashboard.html">
                <i class="fa-solid fa-chart-line"></i>
                <span>Dashboard</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="campaigns.html">
                <i class="fa-solid fa-bullhorn"></i>
                <span>Campaigns</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="templates.html">
                <i class="fa-solid fa-envelope"></i>
                <span>Email Templates</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="users.html">
                <i class="fa-solid fa-users"></i>
                <span>Target Users</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="analytics.html">
                <i class="fa-solid fa-chart-pie"></i>
                <span>Analytics</span>
                </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="reports.html">
                <i class="fa-solid fa-chart"></i>
                <span>Reports</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="training.html">
                <i class="fa-solid fa-graduation-cap"></i>
                <span>Training Materials</span>
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="settings.html">
                <i class="fa-solid fa-gear"></i>
                <span>Settings</span>
            </a>
        </li>
    </ul>
</aside>
```

## Step-by-Step Implementation

### For Each Page (templates.html, users.html, analytics.html, reports.html, training.html, settings.html):

**Step 1:** Add the sidebar CSS to your `<style>` section

**Step 2:** Add the sidebar HTML right after the `<body>` tag

**Step 3:** Update the `.container` class to include `margin-left: 260px;`

**Step 4:** Mark the current page link as active by adding the `active` class. For example:
- On templates.html: `<a class="nav-link active" href="templates.html">`
- On users.html: `<a class="nav-link active" href="users.html">`
- etc.

## Quick Reference

### Active Link Per Page:
- dashboard.html → `<a class="nav-link active" href="dashboard.html">`
- campaigns.html → `<a class="nav-link active" href="campaigns.html">`
- templates.html → `<a class="nav-link active" href="templates.html">`
- users.html → `<a class="nav-link active" href="users.html">`
- analytics.html → `<a class="nav-link active" href="analytics.html">`
- reports.html → `<a class="nav-link active" href="reports.html">`
- training.html → `<a class="nav-link active" href="training.html">`
- settings.html → `<a class="nav-link active" href="settings.html">`

## Example: Adding Sidebar to templates.html

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        /* ... existing styles ... */
        
        /* ADD SIDEBAR STYLES HERE */
        .sidebar { position: fixed; ... }
        /* ... rest of sidebar CSS ... */
        
        /* UPDATE CONTAINER */
        .container { 
            margin-left: 260px;  /* ADD THIS */
            /* ... existing container styles ... */
        }
    </style>
</head>
<body>
    <!-- ADD SIDEBAR HTML HERE -->
    <aside class="sidebar">
        <!-- ... sidebar content ... -->
        <!-- Mark templates link as active -->
        <a class="nav-link active" href="templates.html">...</a>
    </aside>
    
    <!-- Your existing page content -->
    <div class="container">
        ...
    </div>
</body>
</html>
```

## Testing

After adding the sidebar:
1. Navigate to the page
2. Verify sidebar appears on the left
3. Check that current page link is highlighted
4. Test all navigation links work
5. Test responsive behavior (< 1024px width)

## Completed Pages

✅ dashboard.html - Fully implemented
✅ campaigns.html - Fully implemented

## Download All Files

All HTML files are available in the outputs. Simply download:
- dashboard.html (reference implementation)
- campaigns.html (reference implementation)
- All other HTML files (ready for sidebar addition)

Apply the sidebar code to each remaining file following the steps above!
