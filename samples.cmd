@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

cd /d "%SCRIPT_DIR%"
set "RC=0"
set "RATING_CLI_ARGS="

echo [1/3] Running AutoRatingEngineTest...
call run.cmd test
if %ERRORLEVEL% neq 0 (
  set "RC=%ERRORLEVEL%"
  echo [ERROR] AutoRatingEngineTest failed with exit code %RC%.
  goto :done
)

echo [2/3] Running sample rate with named flags...
set "RATING_CLI_ARGS=--territory=68123|--age=72|--symbol=8|--major=0|--minor=0|--accidents=0|--date=2026-11-20"
call run.cmd script src\main\gosu\scratch\RateCli.gsp
set "STEP_RC=%ERRORLEVEL%"
set "RATING_CLI_ARGS="
if %STEP_RC% neq 0 (
  set "RC=%STEP_RC%"
  echo [ERROR] Named-flag rate run failed with exit code %RC%.
  goto :done
)

echo [3/3] Running sample rate with positional arguments...
set "RATING_CLI_ARGS=68123|24|12|0|1|0|2026-03-15"
call run.cmd script src\main\gosu\scratch\RateCli.gsp
set "STEP_RC=%ERRORLEVEL%"
set "RATING_CLI_ARGS="
if %STEP_RC% neq 0 (
  set "RC=%STEP_RC%"
  echo [ERROR] Positional-arg rate run failed with exit code %RC%.
  goto :done
)

echo [OK] All sample runs completed successfully.

:done
echo.
pause
exit /b %RC%