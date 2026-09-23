# Como gravar o jogo com som

**O `video.mp4` desta pasta é mudo.** Não é defeito da captura: o Playwright grava a tela e não tem opção de gravar áudio — o vídeo sai sem faixa de som, e não há como pedir o contrário. Por isso o roteiro `4.2.mjs` prova o som de outro jeito, conferindo em `body[data-som]` que cada efeito disparou na hora certa (a sequência conferida está no `captura.txt`).

Para a apresentação, dá para gravar com som à mão em dois minutos. Qualquer um dos caminhos abaixo serve.

## Antes de gravar, em qualquer caminho

1. Dentro de `Blackjack_21/`, suba o servidor: `node tools/servidor.mjs`
2. Abra no navegador o endereço que ele imprimir, com uma seed que dá punição logo: `?seed=31`
3. **Clique ou aperte uma tecla uma vez.** O navegador só libera áudio depois de um gesto do usuário; antes disso o jogo fica mudo de propósito.
4. Confira que não está mudo: se aparecer `SOM DESLIGADO · M` no canto de cima, aperte **M**.
5. Deixe o volume do sistema em uns 60%: o drone é grave e o impacto é bem mais alto que o resto.

## Caminho 1 — Xbox Game Bar (já vem no Windows 11)

1. Com a janela do navegador em foco, aperte **Win + G**.
2. No painel "Capturar", clique no botão de gravar (ou **Win + Alt + R**).
3. Confira que o microfone está **desligado** e o áudio do sistema **ligado**.
4. Jogue a rodada até a guilhotina descer e pare a gravação.
5. O arquivo sai em `Vídeos/Capturas`.

É o caminho mais rápido e não instala nada.

## Caminho 2 — OBS Studio

1. Fonte → **Captura de Janela**, escolhendo a janela do navegador.
2. Fonte → **Captura de Áudio de Saída** (o áudio que sai pelas caixas).
3. Gravar, jogar a rodada, parar.

Dá mais controle (dá para deixar 1280x720 certinho, que é o tamanho dos prints) e é o melhor se a gravação for para a apresentação.

## Caminho 3 — ffmpeg na linha de comando

Precisa que o "Mixagem estéreo" (Stereo Mix) esteja habilitado em *Configurações → Som → Mais configurações de som → Gravação*. Depois:

```
ffmpeg -f gdigrab -framerate 30 -i desktop -f dshow -i audio="Mixagem estéreo (Realtek(R) Audio)" -c:v libx264 -pix_fmt yuv420p -c:a aac gravacao.mp4
```

Para descobrir o nome exato do dispositivo de áudio da máquina:

```
ffmpeg -list_devices true -f dshow -i dummy
```

## O que dá para ouvir numa rodada

| Momento | O que se ouve |
|---|---|
| O tempo todo | Drone grave, zumbido elétrico da lâmpada (sobe quando ela pisca) |
| Enquanto joga | Coração, mais rápido conforme a aposta sobe e conforme a morte se aproxima |
| Cada carta | Papel deslizando |
| Os dois pararam | **Silêncio**: o ambiente e o coração somem, fica só a carta virando |
| Resultado anunciado | O ambiente volta |
| Guilhotina | Metal sendo armado e descendo |
| Impacto | Pancada seca, zumbido agudo no ouvido e **todo o som abafado** por uns 3,5 s |
| Nível 2 | Capacitor carregando, depois a descarga |
| Nível 3 | Motor da serra ao fundo, mais alto quanto mais perto ela está |
| Kaio na TV | Chiado do alto-falante |
