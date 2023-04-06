@echo on
set PATH=%CD%\bin;%PATH%;
set GIT_SSL_CAINFO=%CD%\bin\ca-bundle.crt

REM Count the arguments
set argC=0
for %%x in (%*) do Set /A argC+=1

if "%argC%"=="0" (
	start "SAGE2" /MIN /D "%~dp0" node "%~dp0\server.js" -l -p ""
) ELSE (
	start "SAGE2" /MIN /D "%~dp0" node "%~dp0\server.js" -l -f %1 -p ""
)
