// Authentication Guard - Include this in every protected page
class AuthGuard {
    static async checkAuth() {
        const token = localStorage.getItem('authToken');

        if (!token) {
            window.location.href = '/sign-in.html';
            return false;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userEmail');
                window.location.href = '/sign-in.html';
                return false;
            }

            const result = await response.json();
            return result.user;
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            window.location.href = '/sign-in.html';
            return false;
        }
    }

    static logout() {
        console.log('AuthGuard.logout() called');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('rememberMe');
        console.log('Tokens removed, redirecting to sign-in...');
        window.location.href = '/sign-in.html';
    }

    static getToken() {
        return localStorage.getItem('authToken');
    }

    static getUser() {
        return localStorage.getItem('userEmail');
    }

    // Add Authorization header to fetch requests
    static fetch(url, options = {}) {
        const token = this.getToken();
        if (!token) {
            this.logout();
            return Promise.reject('No token found');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        return fetch(url, {
            ...options,
            headers
        });
    }
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    const user = await AuthGuard.checkAuth();
    if (user && typeof onAuthSuccess === 'function') {
        onAuthSuccess(user);
    }
});
