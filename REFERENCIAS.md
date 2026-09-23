# Referências guardadas pelo grupo

Links e materiais enviados durante o projeto para consultar nas etapas seguintes. Nenhum deles foi usado ainda. Antes de usar qualquer um, conferir a licença e as regras do `CLAUDE.md` (jogo sem dependências externas, violência sem sangue, Canvas 2D).

## Efeitos de tela (Etapa 4.3 — efeitos visuais)

| Referência | O que é | Para que pode servir | Atenção |
|-----------|---------|---------------------|---------|
| [PixiJS Filters](https://github.com/pixijs/filters) | Biblioteca de filtros para PixiJS: CRT (linhas de varredura), ruído/granulado, vinheta, matriz de cores, glitch | Referência de **como** os efeitos são calculados (os shaders GLSL estão no repositório, licença MIT) | O jogo é Canvas 2D sem dependências; trazer o PixiJS inteiro quebraria a regra. O caminho é **reimplementar** o efeito em `effects.js` (Canvas 2D ou WebGL próprio) usando o shader como guia |
| [mgGlitch](https://github.com/hmongouachon/mgGlitch) | Script JS pequeno de efeito glitch/ruído CRT | Inspiração para a **TV com chiado** atrás do Luiz Alberto (Parte B2 do PDF; aparece na cena de referência do grupo) | É plugin jQuery; copiar a ideia (fatias deslocadas + ruído), não a dependência |

## Efeitos de impacto e partículas (Etapa 1.5 e Etapa 4)

| Referência | O que é | Para que pode servir | Atenção |
|-----------|---------|---------------------|---------|
| [Blood splatter / hit effects (itch.io)](https://itch.io/games-like/1041737/blood-splatter-hit-effects) | Sprites de respingos e impactos | Referência de **timing e forma** de um impacto (guilhotina, choque) | **Sangue está fora** pela regra do projeto. Aproveitar só a leitura de tempo/escala do impacto e trocar por faíscas, poeira, flash branco/vermelho e tremor |
| [Fire animation (brullov, itch.io)](https://brullov.itch.io/fire-animation) | Sprite sheet de fogo em pixel art | Faíscas do taser (nível 2, choque), lâmpada estourando, brasas | Conferir licença antes de incluir o arquivo; alternativa é gerar as partículas em código como o resto da arte |

## Estética PSX / low-poly (Parte B3 do PDF)

| Referência | O que é | Para que pode servir | Atenção |
|-----------|---------|---------------------|---------|
| [Assets PSX no itch.io](https://itch.io/game-assets/tag-3d/tag-psx) | Modelos e texturas 3D estilo PlayStation 1 | Referência de **paleta, textura e granulado** para o visual | O jogo é 2D por decisão do plano. Usar como referência de clima, não como asset |

## Como usar este arquivo

- Ao começar uma etapa, ler a seção correspondente e decidir se a referência entra como **inspiração** (padrão) ou como **arquivo** (só com licença conferida e anotada aqui).
- Registrar no `PROMPTS_E_RESPOSTAS.md` quando uma referência for de fato usada.
