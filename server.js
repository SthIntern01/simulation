const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const nodemailer = require("nodemailer");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
const CONFIG_FILE = path.join(__dirname, "email-config.json");
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const TOKEN_EXPIRY = "24h";

// Security middleware - Helmet with CSP allowing unsafe-inline for development
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "api.ipify.org"],
        },
    },
}));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per IP
    message: "Too many login attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

const db = new sqlite3.Database("clicks.db");

// Create users table for authentication
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1
)
`);

// Create clicks table
db.run(`
CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    dept TEXT,
    campaign TEXT,
    ip TEXT,
    user_agent TEXT,
    time TEXT,
    click_count INTEGER DEFAULT 1
)
`);

// Create campaigns table
db.run(`
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// Create employees table
db.run(`
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employee_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    dept TEXT NOT NULL
)
`);

// Create templates table
db.run(`
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// Seed default users (only if they don't exist)
const seedUsers = async () => {
    const users = [
        {
            email: "bharat@sandboxsecurity.ai",
            password: "!@#$!@#$QWERQWERqwerqwer"
        },
        {
            email: "rahul@sandboxsecurity.ai",
            password: "#$%#$%WERWER"
        }
    ];

    for (const user of users) {
        db.get("SELECT id FROM users WHERE email = ?", [user.email], async (err, row) => {
            if (err) {
                console.error("Error checking user:", err);
                return;
            }
            
            if (!row) {
                try {
                    const hashedPassword = await bcrypt.hash(user.password, 10);
                    db.run(
                        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                        [user.email, hashedPassword],
                        (err) => {
                            if (err) {
                                console.error("Error inserting user:", err);
                            } else {
                                console.log(`✅ User created: ${user.email}`);
                            }
                        }
                    );
                } catch (hashErr) {
                    console.error("Error hashing password:", hashErr);
                }
            } else {
                console.log(`ℹ️  User already exists: ${user.email}`);
            }
        });
    }
};

// Wait a bit for tables to be created, then seed users
setTimeout(seedUsers, 500);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });
};

// Logging endpoint
app.post("/log", (req, res) => {
    const { user_id, dept, campaign, ip, user_agent, time } = req.body;

    // Try to update an existing record for this user/dept/campaign combination
    // This prevents duplicate entries and tracks click count
    db.run(
        `UPDATE clicks SET ip = ?, user_agent = ?, time = ?, click_count = click_count + 1
         WHERE user_id = ? AND dept = ? AND campaign = ?`,
        [ip, user_agent, time, user_id, dept, campaign],
        function(err) {
            if (err) {
                console.error("Update error:", err);
                return res.json({ status: "error" });
            }
            
            // If no record was updated, insert a new click record
            if (this.changes === 0) {
                db.run(
                    `INSERT INTO clicks (user_id, dept, campaign, ip, user_agent, time, click_count)
                     VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [user_id, dept, campaign, ip, user_agent, time],
                    function(err) {
                        if (err) {
                            console.error("Insert error:", err);
                            return res.json({ status: "error" });
                        }
                        res.json({ status: "logged", action: "inserted" });
                    }
                );
            } else {
                res.json({ status: "logged", action: "updated" });
            }
        }
    );
});


// Get all clicks
app.get("/api/clicks", (req, res) => {
    db.all("SELECT * FROM clicks ORDER BY id DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

// Insert pending click records (for generated links)
app.post("/api/clicks/pending", (req, res) => {
    const { records } = req.body;
    
    if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: "Invalid records" });
    }
    
    let completed = 0;
    const errors = [];
    
    records.forEach(record => {
        db.run(
            `INSERT INTO clicks (user_id, dept, campaign, ip, user_agent, time) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [record.user_id, record.dept, record.campaign, record.ip, record.user_agent, record.time],
            function(err) {
                if (err) {
                    errors.push(err.message);
                }
                completed++;
                if (completed === records.length) {
                    if (errors.length > 0) {
                        return res.status(400).json({ error: errors });
                    }
                    res.json({ status: "success", message: `${records.length} pending records created` });
                }
            }
        );
    });
});

// Get all campaigns
app.get("/api/campaigns", (req, res) => {
    db.all("SELECT * FROM campaigns ORDER BY created_at DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get single campaign
app.get("/api/campaigns/:id", (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM campaigns WHERE id = ?", [id], (err, row) => {
        res.json(row || {});
    });
});

// Create campaign
app.post("/api/campaigns", (req, res) => {
    const { name, description, status } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Campaign name is required" });
    }

    db.run(
        `INSERT INTO campaigns (name, description, status)
         VALUES (?, ?, ?)`,
        [name, description || "", status || "active"],
        function(err) {
            if (err) {
                console.error("Error creating campaign:", err);
                return res.status(400).json({ error: "Campaign name already exists" });
            }
            res.json({ id: this.lastID, name, description, status });
        }
    );
});

// Update campaign
app.put("/api/campaigns/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;

    db.run(
        `UPDATE campaigns SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, description || "", status || "active", id],
        function(err) {
            if (err) {
                console.error("Error updating campaign:", err);
                return res.status(400).json({ error: "Error updating campaign" });
            }
            res.json({ id, name, description, status });
        }
    );
});

// Delete campaign
app.delete("/api/campaigns/:id", (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM campaigns WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error("Error deleting campaign:", err);
            return res.status(400).json({ error: "Error deleting campaign" });
        }
        res.json({ status: "deleted" });
    });
});

// Get all templates
app.get("/api/templates", (req, res) => {
    db.all("SELECT * FROM templates ORDER BY created_at DESC", [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get single template
app.get("/api/templates/:id", (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM templates WHERE id = ?", [id], (err, row) => {
        res.json(row || {});
    });
});

// Create template
app.post("/api/templates", (req, res) => {
    const { name, category, subject, body, description } = req.body;

    if (!name || !category || !subject || !body) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    db.run(
        `INSERT INTO templates (name, category, subject, body, description)
         VALUES (?, ?, ?, ?, ?)`,
        [name, category, subject, body, description || ""],
        function(err) {
            if (err) {
                console.error("Error creating template:", err);
                return res.status(400).json({ error: "Template name already exists" });
            }
            res.json({ id: this.lastID, name, category, subject, body, description });
        }
    );
});

// Update template
app.put("/api/templates/:id", (req, res) => {
    const { id } = req.params;
    const { name, category, subject, body, description } = req.body;

    db.run(
        `UPDATE templates SET name = ?, category = ?, subject = ?, body = ?, description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, category, subject, body, description || "", id],
        function(err) {
            if (err) {
                console.error("Error updating template:", err);
                return res.status(400).json({ error: "Error updating template" });
            }
            res.json({ id, name, category, subject, body, description });
        }
    );
});

// Delete template
app.delete("/api/templates/:id", (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM templates WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error("Error deleting template:", err);
            return res.status(400).json({ error: "Error deleting template" });
        }
        res.json({ status: "deleted" });
    });
});

// Get all employees
app.get("/api/employees", (req, res) => {
    db.all("SELECT * FROM employees ORDER BY name", [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get single employee
app.get("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM employees WHERE id = ?", [id], (err, row) => {
        res.json(row || {});
    });
});

// Create employee
app.post("/api/employees", (req, res) => {
    const { name, employee_id, email, dept } = req.body;

    if (!name || !employee_id || !email || !dept) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    db.run(
        `INSERT INTO employees (name, employee_id, email, dept)
         VALUES (?, ?, ?, ?)`,
        [name, employee_id, email, dept],
        function(err) {
            if (err) {
                console.error("Error creating employee:", err);
                return res.status(400).json({ error: "Employee ID or email already exists" });
            }
            res.json({ id: this.lastID, name, employee_id, email, dept });
        }
    );
});

// Update employee
app.put("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    const { name, employee_id, email, dept } = req.body;

    db.run(
        `UPDATE employees SET name = ?, employee_id = ?, email = ?, dept = ?
         WHERE id = ?`,
        [name, employee_id, email, dept, id],
        function(err) {
            if (err) {
                console.error("Error updating employee:", err);
                return res.status(400).json({ error: "Error updating employee" });
            }
            res.json({ id, name, employee_id, email, dept });
        }
    );
});

// Delete employee
app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM employees WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error("Error deleting employee:", err);
            return res.status(400).json({ error: "Error deleting employee" });
        }
        res.json({ status: "deleted" });
    });
});

// Bulk delete all clicks
app.delete("/api/clicks", (req, res) => {
    db.run(`DELETE FROM clicks`, function(err) {
        if (err) {
            console.error("Error deleting clicks:", err);
            return res.status(400).json({ error: "Error deleting clicks" });
        }
        res.json({ status: "deleted", message: "All clicks deleted" });
    });
});

// Delete single click record
app.delete("/api/clicks/:id", (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM clicks WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error("Error deleting click record:", err);
            return res.status(400).json({ error: "Error deleting record" });
        }
        res.json({ status: "deleted", message: "Record deleted successfully" });
    });
});

// Bulk delete all campaigns
app.delete("/api/campaigns", (req, res) => {
    db.run(`DELETE FROM campaigns`, function(err) {
        if (err) {
            console.error("Error deleting campaigns:", err);
            return res.status(400).json({ error: "Error deleting campaigns" });
        }
        res.json({ status: "deleted", message: "All campaigns deleted" });
    });
});

// Bulk delete all templates
app.delete("/api/templates", (req, res) => {
    db.run(`DELETE FROM templates`, function(err) {
        if (err) {
            console.error("Error deleting templates:", err);
            return res.status(400).json({ error: "Error deleting templates" });
        }
        res.json({ status: "deleted", message: "All templates deleted" });
    });
});

// Bulk delete all employees
app.delete("/api/employees", (req, res) => {
    db.run(`DELETE FROM employees`, function(err) {
        if (err) {
            console.error("Error deleting employees:", err);
            return res.status(400).json({ error: "Error deleting employees" });
        }
        res.json({ status: "deleted", message: "All employees deleted" });
    });
});

// Get stats by department
app.get("/api/stats/by-department", (req, res) => {
    db.all(
        `SELECT dept, COUNT(*) as count FROM clicks GROUP BY dept ORDER BY count DESC`,
        [],
        (err, rows) => {
            res.json(rows || []);
        }
    );
});

// Get stats by browser
app.get("/api/stats/by-browser", (req, res) => {
    db.all(
        `SELECT 
            CASE
                WHEN user_agent LIKE '%Chrome%' THEN 'Chrome'
                WHEN user_agent LIKE '%Firefox%' THEN 'Firefox'
                WHEN user_agent LIKE '%Safari%' THEN 'Safari'
                ELSE 'Other'
            END as browser,
            COUNT(*) as count
         FROM clicks
         GROUP BY browser
         ORDER BY count DESC`,
        [],
        (err, rows) => {
            res.json(rows || []);
        }
    );
});

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Test SMTP connection endpoint
app.get("/api/test-email", (req, res) => {
    console.log("\n🔧 ═══════════════════════════════════════════════════");
    console.log("TESTING SMTP CONNECTION");
    console.log("═══════════════════════════════════════════════════");
    
    const nodemailerConfig = getEmailConfigForNodemailer();
    const transporter = nodemailer.createTransport(nodemailerConfig);
    
    console.log("Config being tested:");
    console.log("  Host:", emailConfig.host);
    console.log("  Port:", emailConfig.port);
    console.log("  Secure:", emailConfig.secure);
    console.log("  User:", emailConfig.user);
    console.log("  Pass length:", emailConfig.pass.length);
    
    transporter.verify((error, success) => {
        if (error) {
            console.error("❌ VERIFICATION FAILED");
            console.error("Error Message:", error.message);
            console.error("Error Code:", error.code);
            console.error("Error Response:", error.response);
            console.error("═══════════════════════════════════════════════════\n");
            
            res.status(400).json({
                status: "failed",
                error: error.message,
                code: error.code,
                response: error.response
            });
        } else {
            console.log("✅ VERIFICATION SUCCESSFUL");
            console.log("═══════════════════════════════════════════════════\n");
            res.json({ status: "success", message: "SMTP connection verified!" });
        }
    });
});

// Get email configuration
app.get("/api/email-config", (req, res) => {
    res.json({
        host: emailConfig.host,
        port: emailConfig.port,
        user: emailConfig.user,
        pass: emailConfig.pass,
        secure: emailConfig.secure
    });
});

// Save email configuration
app.post("/api/email-config", (req, res) => {
    const { host, port, user, pass, secure } = req.body;

    if (!host || !port || !user || !pass) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Update in-memory config
    emailConfig = {
        host,
        port: parseInt(port),
        user,
        pass,
        secure: secure === true
    };

    // Save to file
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(emailConfig, null, 2), 'utf-8');
        console.log("✅ Email configuration saved to file");
        
        res.json({ 
            status: "success", 
            message: "Email configuration saved",
            config: emailConfig 
        });
    } catch (error) {
        console.error("Error saving configuration:", error);
        res.status(500).json({ error: "Failed to save configuration: " + error.message });
    }
});

// Test SMTP connection with provided config
app.post("/api/test-smtp", (req, res) => {
    const { host, port, user, pass, secure } = req.body;

    if (!host || !port || !user || !pass) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("\n🔧 ═══════════════════════════════════════════════════");
    console.log("TESTING SMTP CONNECTION");
    console.log("═══════════════════════════════════════════════════");
    console.log("Config:");
    console.log("  Host:", host);
    console.log("  Port:", port);
    console.log("  Secure:", secure);
    console.log("  User:", user);
    
    const testTransporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure === true,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false,
            minVersion: "TLSv1.2"
        },
        logger: true,
        debug: true
    });

    testTransporter.verify((error, success) => {
        if (error) {
            console.error("❌ VERIFICATION FAILED");
            console.error("Error:", error.message);
            console.error("═══════════════════════════════════════════════════\n");
            
            res.status(400).json({
                status: "failed",
                error: error.message,
                code: error.code,
                details: error.response || error.message
            });
        } else {
            console.log("✅ VERIFICATION SUCCESSFUL");
            console.log("═══════════════════════════════════════════════════\n");
            res.json({ 
                status: "success", 
                message: "SMTP connection verified successfully!" 
            });
        }
    });
});

// Load email configuration from file or use defaults
function loadEmailConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading email config:", error.message);
    }
    
    // Default configuration
    return {
        host: process.env.SMTP_HOST || "smtp.titan.email",
        port: process.env.SMTP_PORT || 587,
        secure: false, // Must be false for port 587 (TLS)
        user: process.env.SMTP_USER || "sandboxsecurity@staff-benefits-hub.com",
        pass: process.env.SMTP_PASS || "!!@@##112233QQWWEEqqwwee"
    };
}

let emailConfig = loadEmailConfig();

// Build full nodemailer config from emailConfig
function getEmailConfigForNodemailer() {
    return {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure === true, // Convert to boolean
        auth: {
            user: emailConfig.user,
            pass: emailConfig.pass
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: "TLSv1.2"
        },
        logger: true,
        debug: true
    };
}

console.log("\n═══════════════════════════════════════════════════");
console.log("📧 EMAIL CONFIGURATION");
console.log("═══════════════════════════════════════════════════");
console.log("SMTP Host:", emailConfig.host);
console.log("SMTP Port:", emailConfig.port);
console.log("SMTP Secure:", emailConfig.secure);
console.log("SMTP User:", emailConfig.user);
console.log("SMTP Pass Length:", emailConfig.pass.length, "characters");
console.log("SMTP Pass (masked):", emailConfig.pass.substring(0, 3) + "***" + emailConfig.pass.substring(emailConfig.pass.length - 3));
console.log("═══════════════════════════════════════════════════\n");

if (emailConfig.user === "sandboxsecurity@staff-benefits-hub.com" && emailConfig.pass === "!!@@##112233QQWWEEqqwwee") {
    console.warn("⚠️  WARNING: Using default email configuration!");
    console.warn("⚠️  Please configure email settings at: http://localhost:3000/email-settings.html\n");
}

// Send bulk emails with tracking links
app.post("/api/send-emails", (req, res) => {
    const { recipients, campaign, template, trackingLinks, linkMasking } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No recipients provided" });
    }

    if (!campaign || !template) {
        return res.status(400).json({ error: "Campaign and template required" });
    }

    // Create transporter with current email config
    const nodemailerConfig = getEmailConfigForNodemailer();
    const transporter = nodemailer.createTransport({
        ...nodemailerConfig,
        connectionTimeout: 5000,
        socketTimeout: 5000
    });

    // Test SMTP connection first
    transporter.verify((error, success) => {
        if (error) {
            console.error("\n❌ ═══════════════════════════════════════════════════");
            console.error("SMTP CONNECTION FAILED");
            console.error("═══════════════════════════════════════════════════");
            console.error("Error:", error.message);
            console.error("Code:", error.code);
            console.error("\nCommon causes:");
            if (error.message.includes("Invalid login") || error.message.includes("BadCredentials")) {
                console.error("  • Wrong email or password");
                console.error("  • GoDaddy Titan: Check exact password spelling");
                console.error("  • Make sure no extra spaces in password");
            } else if (error.message.includes("ECONNREFUSED")) {
                console.error("  • Cannot reach SMTP server");
                console.error("  • Check firewall/network settings");
                console.error("  • Verify host: " + emailConfig.host);
            } else if (error.message.includes("ETIMEDOUT") || error.message.includes("EHOSTUNREACH")) {
                console.error("  • Connection timeout");
                console.error("  • Check network connectivity");
                console.error("  • Port 587 may be blocked by firewall");
            }
            console.error("\nCurrent Config:");
            console.error("  Host:", emailConfig.host);
            console.error("  Port:", emailConfig.port);
            console.error("  User:", emailConfig.user);
            console.error("═══════════════════════════════════════════════════\n");

            return res.status(400).json({ 
                error: "SMTP connection failed: " + error.message,
                details: error.message,
                code: error.code,
                config: { host: emailConfig.host, port: emailConfig.port, user: emailConfig.user }
            });
        }
        
        console.log("✅ SMTP connection verified successfully!\n");
        
        // Only proceed with sending after verification succeeds
        sendEmails(recipients, campaign, template, trackingLinks, linkMasking, transporter, res);
    });
});

function sendEmails(recipients, campaign, template, trackingLinks, linkMasking, transporter, res) {
    let sent = 0;
    let failed = 0;
    const errors = [];

    recipients.forEach((recipient, index) => {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipient.email)) {
            failed++;
            errors.push(`${recipient.email}: Invalid email format`);
            if (sent + failed === recipients.length) {
                res.json({
                    status: "completed",
                    sent,
                    failed,
                    total: recipients.length,
                    errors: errors.length > 0 ? errors : undefined
                });
            }
            return;
        }

        const trackingLink = trackingLinks && trackingLinks[index] ? trackingLinks[index] : "";
        
        // Prepare email body with template variables
        let emailBody = template.body || "Please review the attached security information.";
        
        // Handle link masking and placement
        if (trackingLink) {
            const linkDisplayText = linkMasking && linkMasking.enabled 
                ? linkMasking.displayText 
                : trackingLink;
            
            const linkHtml = `<a href="${trackingLink}" style="background: #2563eb; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">${linkDisplayText}</a>`;
            
            // Replace placeholder or append link
            if (emailBody.includes('{{LINK_TEXT}}')) {
                emailBody = emailBody.replace('{{LINK_TEXT}}', linkHtml);
            } else {
                emailBody += `<p style="margin-top: 2rem; text-align: center;">${linkHtml}</p>`;
            }
        }

        const mailOptions = {
            from: emailConfig.user,
            to: recipient.email,
            subject: template.subject || "Important Security Update",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <p>Dear ${recipient.name},</p>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1.5rem 0; line-height: 1.6;">
                        ${emailBody}
                    </div>
                    <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 0.85rem; color: #64748b;">Campaign: ${campaign}</p>
                </div>
            `
        };

        console.log(`📨 Sending email to ${recipient.email}...`);

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                failed++;
                const errorMsg = `${recipient.email}: ${err.message}`;
                errors.push(errorMsg);
                console.error("❌ Email failed:", errorMsg);
            } else {
                sent++;
                console.log(`✅ Email sent to ${recipient.email}`);
            }

            if (sent + failed === recipients.length) {
                const result = {
                    status: "completed",
                    sent,
                    failed,
                    total: recipients.length,
                    errors: errors.length > 0 ? errors : undefined
                };
                console.log("📊 Email Send Summary:", result);
                res.json(result);
            }
        });
    });
}

// ==================== AUTHENTICATION ENDPOINTS ====================

// Sign In
app.post("/api/auth/signin", loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    console.log(`\n🔐 Sign-in attempt: ${username}`);

    // Input validation
    if (!username || !password) {
        console.log("❌ Missing credentials");
        return res.status(400).json({ error: "Username and password are required" });
    }

    try {
        db.get("SELECT * FROM users WHERE email = ? AND is_active = 1", [username], async (err, user) => {
            if (err) {
                console.error("❌ Database error:", err);
                return res.status(500).json({ error: "Database error" });
            }

            if (!user) {
                console.log("❌ User not found:", username);
                // Don't reveal if user exists (security best practice)
                return res.status(401).json({ error: "Invalid credentials" });
            }

            console.log("✅ User found:", username);

            // Verify password
            const passwordValid = await bcrypt.compare(password, user.password_hash);
            if (!passwordValid) {
                console.log("❌ Invalid password");
                return res.status(401).json({ error: "Invalid credentials" });
            }

            console.log("✅ Password valid");

            // Update last login
            db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            console.log("✅ Token generated for:", username);

            res.json({
                success: true,
                message: "Sign in successful",
                token,
                user: {
                    id: user.id,
                    email: user.email
                }
            });
        });
    } catch (error) {
        console.error("❌ Sign-in error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Verify Token
app.post("/api/auth/verify", authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Logout (client-side token deletion, but we can invalidate sessions here)
app.post("/api/auth/logout", authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: "Logged out successfully"
    });
});

// ==================== PROTECTED ENDPOINTS ====================

// Dashboard root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(3000, "52.66.208.172", () => {
    console.log("✅ Tracker running");
    console.log("➡️  Dashboard: http://52.66.208.172:3000/dashboard.html");
});



