@echo off
REM Test authentication API endpoints

echo.
echo ========================================
echo 🧪 Testing SandBox Security Authentication
echo ========================================
echo.

REM Test Sign-In with correct credentials
echo 📝 Test 1: Sign-in with CORRECT credentials
echo Credentials: bharat@sandboxsecurity.ai / !@#$!@#$QWERQWERqwerqwer
echo.

curl -X POST http://localhost:3000/api/auth/signin ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"bharat@sandboxsecurity.ai\",\"password\":\"!@#$!@#$QWERQWERqwerqwer\"}" ^
  --silent | powershell -Command "$input | ConvertFrom-Json | ConvertTo-Json -Depth 10"

echo.
echo.
echo 📝 Test 2: Sign-in with WRONG password
echo.

curl -X POST http://localhost:3000/api/auth/signin ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"bharat@sandboxsecurity.ai\",\"password\":\"wrongpassword\"}" ^
  --silent | powershell -Command "$input | ConvertFrom-Json | ConvertTo-Json -Depth 10"

echo.
echo.
echo ========================================
echo ✅ Authentication tests complete!
echo ========================================
