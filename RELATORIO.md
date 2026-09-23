# Relatório — Atividade 02: Criando um Jogo

**Jogo:** 21 (blackjack de vida ou morte)
**Grupo:** _preencher_
**Disciplina / Professor:** Agentes — Andrei Formiga
**Data de entrega:** _preencher_

Estrutura exigida pelo guia: (1) experiência prévia, (2) relato do desenvolvimento por etapa, (3) conclusões e comentários. Os prompts completos estão em `PROMPTS_E_RESPOSTAS.md`; aqui entram só os principais.

---

## 1. Experiência prévia

_Responder:_
- Experiência do grupo com HTML/JavaScript/TypeScript antes do projeto.
- Experiência do grupo com desenvolvimento de jogos (qualquer plataforma).
- Experiência do grupo com agentes de codificação (Claude Code, Copilot, Cursor etc.).
- Conhecimento do jogo escolhido (quem já jogou o 21 do RE7 / Buckshot Roulette).

---

## 2. Relato do desenvolvimento

### 2.0 Ferramentas e estrutura de agentes

| Item | Valor |
|------|-------|
| Ferramenta de pesquisa | Claude (chat, claude.ai) |
| Agente de codificação | Claude Code, extensão do VS Code |
| Modelo | Claude Fable 5.1 (`claude-fable-5-1`) |
| Estrutura | Agente único; _atualizar se subagentes forem usados_ |
| Stack | HTML + CSS + JavaScript puro, Canvas 2D, sem build |

### 2.1 Fase 0 — Documento de referência
_O que foi feito:_ dois prompts no Claude (chat) geraram `21_referencia_jogo.pdf` e `trump_cards.json` a partir da wiki e das referências de atmosfera.
_Comentários:_

### 2.2 Fase 1 — Planejamento
_O que foi feito:_ um prompt no Claude Code leu o guia da atividade e as referências e produziu o plano incremental sem código.
_Comentários:_

### 2.3 Etapa 1 — Base do jogo
_Prompts principais:_
_Quantidade de prompts de correção:_
_O que funcionou de primeira / o que precisou de retrabalho:_
_Análise do código gerado (legibilidade, organização, algo estranho):_
_Screenshot:_

### 2.4 Etapa 2 — Níveis e pontuação
_Prompts principais:_
_Quantidade de prompts de correção:_
_O que funcionou / retrabalho:_
_Análise do código gerado:_
_Screenshot:_

### 2.5 Etapa 3 — Tela de abertura e GAME OVER
_Prompts principais:_
_Quantidade de prompts de correção:_
_O que funcionou / retrabalho:_
_Análise do código gerado:_
_Screenshot:_

### 2.6 Etapa 4 — Extras
_Extras implementados (da lista do plano):_
_Prompts principais:_
_Retrabalho:_
_Análise do código gerado:_
_Screenshot:_

---

## 3. Conclusões e comentários

_Perguntas do guia para responder:_

1. **Falta de experiência.** Para quem não tinha experiência com as tecnologias ou com jogos: isso impactou o projeto? Se fossem continuar, precisariam estudar mais as tecnologias ou o desenvolvimento de jogos em geral?
2. **Aprendizado.** O que aprenderam? Conseguiriam fazer um projeto similar sem agentes?
3. **Qualidade do código final.** O código é legível? Seria fácil de manter? Precisaria refatorar?
4. **Déficit de compreensão.** Sentem que entendem o projeto gerado? Conseguiriam alterar sem agentes? Como julgaram se uma modificação pedida ao agente deu certo?
5. **Outros comentários** sobre o processo (o que o agente fez além do pedido, quando o plano em etapas ajudou, quando atrapalhou, custo em tempo/prompts).

---

## Anexos
- `PROMPTS_E_RESPOSTAS.md` — registro completo de prompts
- `PLANO_DE_DESENVOLVIMENTO.md` — plano usado
- Código do jogo (pasta `src/`, `index.html`, `tests/`)
