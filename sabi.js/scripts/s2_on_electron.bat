@REM off

REM This file will assumes that electron will always be 1 display AND top left most monitor has origin coordinate.
REM This file must retain this naming format, due to special check condition in sabi server.

REM Parameters are as followed
REM %1 path to config, doesn't work for custom
REM %2 index_port, NOT https
REM %3 width
REM %4 height
REM %5 host in the config file, added here to allow for backwards compatibility
REM %6 hash

REM Count the arguments
set argC=0
for %%x in (%*) do Set /A argC+=1

start "sage2" /MIN /D .. sage2.bat %1

REM delay x for seconds
ping localhost -n 3

if "%argC%"=="5" (
	REM audio manager
	start "Electron Audio" /MIN electron.bat --server=https://%5:%2 --audio
	REM display
	start "Electron Display" /MIN electron.bat --server=https://%5:%2 --display 0 --no_decoration --xorigin 0 --yorigin 0 --width %3 --height %4
) ELSE (
	REM audio manager
	start "Electron Audio" /MIN electron.bat --server=https://%5:%2 --audio --hash %6
	REM display
	start "Electron Display" /MIN electron.bat --server=https://%5:%2 --display 0 --no_decoration --xorigin 0 --yorigin 0 --width %3 --height %4 --hash %6
)
