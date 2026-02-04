const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const db = new sqlite3.Database("clicks.db");

// Check if users exist
db.all("SELECT email, password_hash FROM users", async (err, rows) => {
    if (err) {
        console.error("Error reading users:", err);
        return;
    }
    
    console.log("Users in database:");
    console.log(rows);
    
    // Test bcrypt with first user if exists
    if (rows && rows.length > 0) {
        const user = rows[0];
        console.log("\nTesting bcrypt with:", user.email);
        
        // Test with correct password
        const testPasswords = [
            "!@#$!@#$QWERQWERqwerqwer",
            "#$%#$%WERWER",
            "wrongpassword"
        ];
        
        for (const testPass of testPasswords) {
            try {
                const match = await bcrypt.compare(testPass, user.password_hash);
                console.log(`Password "${testPass}": ${match ? "✅ MATCH" : "❌ NO MATCH"}`);
            } catch (e) {
                console.error(`Error testing password: ${e.message}`);
            }
        }
    }
    
    db.close();
});
