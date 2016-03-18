@echo off

@@ echo Enter folder index to compare with "screens" folder.
@@ echo E.g. for folder "screens [5]" enter 5.
@@ echo.

set /p FOLDER="Folder index: "

mkdir compare
cd bin
for /R "../screens" %%F in ("*.png") do (
	echo %%~nxF
	compare "../screens/%%~nxF" "../screens [%FOLDER%]/%%~nxF" "../compare/%%~nxF"
)