@echo off
setlocal
set "APP_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:4173/"

pushd "%APP_DIR%" || (
  echo Could not find the Course Weft project directory: "%APP_DIR%"
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and try again.
  popd
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required. Install Node.js with npm and try again.
  popd
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Course Weft dependencies are missing. Installing from package-lock.json...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Review the error above.
    popd
    pause
    exit /b 1
  )
)

call npm run build
if errorlevel 1 (
  echo Course Weft could not be built. Review the error above.
  popd
  pause
  exit /b 1
)

start "Course Weft Preview Server" /D "%APP_DIR%" cmd /k "npm run preview -- --host 127.0.0.1 --strictPort"
powershell -NoProfile -Command "$url = '%APP_URL%'; for ($i = 0; $i -lt 40; $i++) { try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 } } catch { }; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo Course Weft preview did not become available at %APP_URL%
  popd
  pause
  exit /b 1
)

start "" "%APP_URL%"
popd
endlocal
