@echo off
rem Atalho para jogar sem abrir link nenhum: e so dar dois cliques aqui.
rem Sobe o servidor do jogo e abre o navegador padrao sozinho.
cd /d "%~dp0"
title 21 - servidor do jogo
echo.
echo   21 - abrindo o jogo no navegador...
echo   Feche esta janela (ou Ctrl+C) para parar o jogo.
echo.
node tools/servidor.mjs 8080 --abrir
pause
