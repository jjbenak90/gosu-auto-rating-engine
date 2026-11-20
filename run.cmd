@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "JAVA_EXE=java"
if not "%JAVA_HOME%"=="" (
  if exist "%JAVA_HOME%\bin\javac.exe" if exist "%JAVA_HOME%\bin\java.exe" (
    set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
  )
)

if "%JAVA_EXE%"=="java" (
  for /D %%D in ("C:\Program Files\Java\jdk*" "C:\Program Files\Eclipse Adoptium\jdk*" "C:\Program Files\Microsoft\jdk*" "C:\Program Files\Amazon Corretto\jdk*" "C:\Program Files\BellSoft\LibericaJDK*") do (
    if exist "%%~fD\bin\javac.exe" if exist "%%~fD\bin\java.exe" (
      set "JAVA_HOME=%%~fD"
      set "JAVA_EXE=%%~fD\bin\java.exe"
      goto :found_jdk
    )
  )
)

:found_jdk
if "%JAVA_EXE%"=="java" (
  echo [WARN] No JDK with javac.exe found via JAVA_HOME or standard JDK folders; falling back to system java.
  echo [WARN] If you see NoClassDefFoundError: com/sun/tools/javac/api/JavacTool, install a JDK and set JAVA_HOME.
)

set "TOOLS_JAR="
if not "%JAVA_HOME%"=="" (
  if exist "%JAVA_HOME%\lib\tools.jar" set "TOOLS_JAR=;%JAVA_HOME%\lib\tools.jar"
)

if "%GOSU_HOME%"=="" (
  if exist "%USERPROFILE%\Gosu\gosu-1.14.16\lib" (
    set "GOSU_HOME=%USERPROFILE%\Gosu\gosu-1.14.16"
  ) else if exist "C:\gosu\gosu-1.14.16\lib" (
    set "GOSU_HOME=C:\gosu\gosu-1.14.16"
  )
)

if "%GOSU_HOME%"=="" (
  echo [ERROR] GOSU_HOME is not set and Gosu 1.14.16 was not found in default locations.
  echo Set GOSU_HOME to your Gosu installation folder ^(e.g. set GOSU_HOME=C:\path\to\gosu-1.14.16^).
  exit /b 1
)

if not exist "%GOSU_HOME%\lib" (
  echo [ERROR] Gosu lib directory not found: "%GOSU_HOME%\lib"
  exit /b 1
)

set "PG_JAR="
if not "%PG_JDBC_JAR%"=="" (
  if exist "%PG_JDBC_JAR%" set "PG_JAR=%PG_JDBC_JAR%"
)

if "%PG_JAR%"=="" (
  for %%F in ("%GOSU_HOME%\lib\postgresql-*.jar" "%SCRIPT_DIR%\lib\postgresql-*.jar") do (
    if exist "%%F" (
      set "PG_JAR=%%F"
      goto :found_jar
    )
  )
)

:found_jar
if "%PG_JAR%"=="" (
  echo [ERROR] PostgreSQL JDBC driver JAR not found.
  echo Set PG_JDBC_JAR to a postgresql-*.jar path or place it in "%GOSU_HOME%\lib" or "%SCRIPT_DIR%\lib".
  exit /b 1
)

set "CP=%SCRIPT_DIR%\src\main\gosu;%GOSU_HOME%\lib\*;%PG_JAR%%TOOLS_JAR%"

if /I "%~1"=="" goto :run_tests
if /I "%~1"=="test" (
  shift
  goto :run_tests
)
if /I "%~1"=="rate" (
  shift
  goto :run_rate
)
if /I "%~1"=="script" (
  shift
  goto :run_script
)

echo Usage:
echo   run.cmd test [extra args...]
echo   run.cmd rate [--territory=68123 --age=24 --symbol=12 --major=0 --minor=1 --accidents=0 --date=2026-09-15]
echo   run.cmd script ^<path-to-gsp^> [extra args...]
exit /b 1

:run_tests
"%JAVA_EXE%" -cp "%CP%" gw.lang.Gosu -fqn rateengine.test.AutoRatingEngineTest %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_rate
"%JAVA_EXE%" -cp "%CP%" gw.lang.Gosu -fqn rateengine.ProductionAutoRatingEngine %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:run_script
if "%~1"=="" (
  echo [ERROR] Please specify a .gsp script path, e.g. run.cmd script src\main\gosu\scratch\RunMe.gsp
  exit /b 1
)
set "TARGET_SCRIPT=%~1"
shift
"%JAVA_EXE%" -cp "%CP%" gw.lang.Gosu "%TARGET_SCRIPT%" %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%