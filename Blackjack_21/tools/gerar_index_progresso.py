# -*- coding: utf-8 -*-
"""Monta o progresso/index.html: a evolucao do trabalho, etapa por etapa.

Le as pastas de evidencia (progresso/etapa-N/...), pega a descricao de
cada captura no captura.txt e a data da entrada correspondente em
progresso/LINHA_DO_TEMPO.md, e escreve uma pagina unica com os prints e
videos em ordem, para abrir na apresentacao.

    python tools/gerar_index_progresso.py

Roda de novo sempre que houver evidencia nova. Python so aparece nas
ferramentas; o jogo continua sem dependencia.
"""
import html
import io
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
PROGRESSO = os.path.join(RAIZ, 'progresso')

TITULOS_DAS_ETAPAS = {
    '1': 'Etapa 1 — a base do jogo',
    '2': 'Etapa 2 — níveis, pontuação e cartas trunfo',
    '3': 'Etapa 3 — tela de abertura, GAME OVER e o ciclo de fliperama',
    '4': 'Etapa 4 — os extras',
}


def ordem_da_pasta(nome):
    """1.1 antes de 1.10, e 'final'/'regressao' por último."""
    if nome == 'final':
        return (3, 0, 0)
    if nome == 'regressao':
        return (2, 0, 0)
    m = re.match(r'^(\d+)\.(\d+)([a-z]?)$', nome)
    if m:
        return (0, int(m.group(2)), m.group(3) or '')
    return (1, 0, nome)


def ler_linha_do_tempo():
    """Mapeia 'sub-passo 3.3' -> (data, titulo da entrada)."""
    caminho = os.path.join(PROGRESSO, 'LINHA_DO_TEMPO.md')
    if not os.path.exists(caminho):
        return {}
    texto = io.open(caminho, encoding='utf-8').read()
    entradas = {}
    for data, titulo in re.findall(r'^## (\d{4}-\d{2}-\d{2}) [—-] (.+)$', texto, re.M):
        m = re.search(r'sub-passo (\d+\.\w+)', titulo)
        chave = m.group(1) if m else titulo
        entradas[chave] = (data, titulo)
        if 'fechada' in titulo.lower():
            m2 = re.search(r'Etapa (\d+)', titulo)
            if m2:
                entradas[f'etapa-{m2.group(1)}-final'] = (data, titulo)
    return entradas


def ler_captura(pasta):
    """Devolve (descricao, notas, erros) do captura.txt."""
    caminho = os.path.join(pasta, 'captura.txt')
    if not os.path.exists(caminho):
        return ('', [], '')
    texto = io.open(caminho, encoding='utf-8').read()
    descricao = ''
    m = re.search(r'^Roteiro: (.*)$', texto, re.M)
    if m:
        descricao = m.group(1).strip()
    notas = re.findall(r'^nota\s+(.*)$', texto, re.M)
    erros = ''
    m = re.search(r'^Erros do navegador: (\d+)', texto, re.M)
    if m and m.group(1) != '0':
        erros = f'{m.group(1)} erro(s) de navegador'
    return (descricao, notas, erros)


def bloco_de_pasta(etapa, nome, entradas):
    pasta = os.path.join(PROGRESSO, f'etapa-{etapa}', nome)
    arquivos = sorted(os.listdir(pasta))
    prints = [a for a in arquivos if a.lower().endswith('.png')]
    videos = [a for a in arquivos if a.lower().endswith(('.mp4', '.webm'))]
    outros = [a for a in arquivos if a.lower().endswith('.md')]
    descricao, notas, erros = ler_captura(pasta)

    chave = nome if nome not in ('final', 'regressao') else f'etapa-{etapa}-final'
    data, titulo = entradas.get(chave, ('', ''))
    rotulo = {'final': 'captura final da etapa', 'regressao': 'regressão'}.get(nome, f'sub-passo {nome}')

    partes = ['<section class="passo">']
    partes.append('<h3><span class="rotulo">%s</span>%s</h3>' % (
        html.escape(rotulo),
        f'<span class="data">{html.escape(data)}</span>' if data else '',
    ))
    if titulo:
        partes.append(f'<p class="titulo">{html.escape(titulo)}</p>')
    if descricao:
        partes.append(f'<p class="descricao">{html.escape(descricao)}</p>')
    if erros:
        partes.append(f'<p class="erro">{html.escape(erros)}</p>')

    if notas:
        partes.append('<ul class="notas">')
        for nota in notas:
            partes.append(f'<li>{html.escape(nota)}</li>')
        partes.append('</ul>')

    if videos:
        for v in videos:
            caminho = f'etapa-{etapa}/{nome}/{v}'
            partes.append(
                f'<video controls preload="none" src="{html.escape(caminho)}"></video>')

    if prints:
        partes.append('<div class="galeria">')
        for imagem in prints:
            caminho = f'etapa-{etapa}/{nome}/{imagem}'
            legenda = re.sub(r'^\d+-', '', imagem[:-4]).replace('-', ' ')
            partes.append(
                f'<figure><a href="{html.escape(caminho)}" target="_blank">'
                f'<img loading="lazy" src="{html.escape(caminho)}" alt="{html.escape(legenda)}">'
                f'</a><figcaption>{html.escape(legenda)}</figcaption></figure>')
        partes.append('</div>')

    for doc in outros:
        caminho = f'etapa-{etapa}/{nome}/{doc}'
        partes.append(f'<p class="anexo"><a href="{html.escape(caminho)}">{html.escape(doc)}</a></p>')

    partes.append('</section>')
    return '\n'.join(partes)


def main():
    entradas = ler_linha_do_tempo()
    etapas = sorted(
        d for d in os.listdir(PROGRESSO)
        if d.startswith('etapa-') and os.path.isdir(os.path.join(PROGRESSO, d))
    )

    corpo = []
    total_prints = 0
    total_videos = 0

    for pasta_etapa in etapas:
        numero = pasta_etapa.split('-')[1]
        caminho = os.path.join(PROGRESSO, pasta_etapa)
        subpastas = sorted(
            (d for d in os.listdir(caminho) if os.path.isdir(os.path.join(caminho, d))),
            key=ordem_da_pasta,
        )
        corpo.append(f'<h2 id="etapa-{numero}">{html.escape(TITULOS_DAS_ETAPAS.get(numero, pasta_etapa))}</h2>')
        resumo = os.path.join(caminho, 'RESUMO.md')
        if os.path.exists(resumo):
            corpo.append(
                f'<p class="anexo"><a href="{pasta_etapa}/RESUMO.md">resumo da etapa</a></p>')
        for sub in subpastas:
            corpo.append(bloco_de_pasta(numero, sub, entradas))
            arquivos = os.listdir(os.path.join(caminho, sub))
            total_prints += len([a for a in arquivos if a.lower().endswith('.png')])
            total_videos += len([a for a in arquivos if a.lower().endswith(('.mp4', '.webm'))])

    indice = ' · '.join(
        f'<a href="#etapa-{d.split("-")[1]}">{d.split("-")[1]}</a>' for d in etapas)

    pagina = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>21 — a evolução do trabalho</title>
<link rel="icon" href="data:,">
<style>
  :root {{ color-scheme: dark; }}
  body {{
    margin: 0; padding: 0 24px 80px;
    background: #0b0a0a; color: #ece6da;
    font-family: "Courier New", Courier, monospace; line-height: 1.5;
  }}
  header {{ padding: 48px 0 24px; border-bottom: 1px solid #2a2724; }}
  h1 {{ font-size: 44px; margin: 0 0 8px; letter-spacing: 2px; }}
  .equipe {{ color: #b0a89a; margin: 0 0 16px; }}
  .numeros {{ color: #8e857a; font-size: 14px; }}
  .indice {{ margin: 16px 0 0; font-size: 14px; }}
  .indice a {{ color: #e0554a; text-decoration: none; }}
  h2 {{
    margin: 56px 0 8px; font-size: 26px; color: #f2ece0;
    border-left: 4px solid #e0554a; padding-left: 12px;
  }}
  .passo {{ margin: 28px 0 40px; padding: 16px 0 0; border-top: 1px solid #201d1b; }}
  .passo h3 {{ margin: 0 0 4px; font-size: 17px; font-weight: normal; }}
  .rotulo {{ color: #f2ece0; text-transform: uppercase; letter-spacing: 1px; }}
  .data {{ color: #6d685f; margin-left: 12px; font-size: 13px; }}
  .titulo {{ margin: 0 0 6px; color: #b0a89a; font-size: 14px; }}
  .descricao {{ margin: 0 0 10px; color: #8e857a; font-size: 13px; }}
  .erro {{ color: #e0554a; }}
  .notas {{ margin: 8px 0 14px; padding-left: 18px; color: #9a9184; font-size: 13px; }}
  .galeria {{ display: flex; flex-wrap: wrap; gap: 12px; }}
  figure {{ margin: 0; width: 300px; }}
  img {{ width: 100%; display: block; border: 1px solid #2a2724; background: #000; }}
  figcaption {{ font-size: 11px; color: #6d685f; margin-top: 4px; }}
  video {{ width: 640px; max-width: 100%; display: block; margin: 0 0 14px; border: 1px solid #2a2724; }}
  .anexo a {{ color: #e0554a; font-size: 13px; }}
  footer {{ margin-top: 64px; padding-top: 16px; border-top: 1px solid #2a2724; color: #6d685f; font-size: 12px; }}
</style>
</head>
<body>
<header>
  <h1>21</h1>
  <p class="equipe">João Gabriel · Luiz Alberto · Kaio — Atividade 02</p>
  <p class="numeros">{total_prints} prints e {total_videos} vídeos, em ordem, de todas as etapas.
  Cada bloco traz o que o roteiro de captura conferiu naquele momento.</p>
  <p class="indice">etapas: {indice}</p>
</header>
{os.linesep.join(corpo)}
<footer>
  Gerado por <code>python tools/gerar_index_progresso.py</code> a partir das pastas de evidência
  e da <code>LINHA_DO_TEMPO.md</code>. Os vídeos são mudos: o Playwright grava tela, não áudio
  (ver <code>etapa-4/4.2/COMO-GRAVAR-COM-SOM.md</code>).
</footer>
</body>
</html>
"""

    destino = os.path.join(PROGRESSO, 'index.html')
    io.open(destino, 'w', encoding='utf-8').write(pagina)
    print(f'{destino}: {total_prints} prints, {total_videos} vídeos')
    return 0


if __name__ == '__main__':
    sys.exit(main())
