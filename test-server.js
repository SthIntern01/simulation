const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({ message: 'Server is working!' });
});

app.post('/api/auth/signin', express.json(), (req, res) => {
    console.log('🔐 Sign-in request received:', req.body);
    res.json({
        success: true,
        message: 'Sign in successful',
        token: 'test-token-123',
        user: {
            id: 1,
            email: req.body.username
        }
    });
});

app.listen(3000, () => {
    console.log('✅ Test server running on http://localhost:3000');
});
