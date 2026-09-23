"""
gerar_mao.py — rasteriza a mão em pixel art, camada por camada, e exporta
para src/ui/sprites/mao.js.

Por que um gerador: a mão tem 64x36 pixels com sombreamento em 5 tons,
arranhões, hematomas, algema e corrente. Digitar isso à mão, pixel a
pixel, é lento e propenso a erro; aqui a forma vem de cápsulas e
polígonos, o sombreamento vem da direção da luz (alto-esquerda), e os
detalhes (unhas, arranhões, hematomas, corrente) são pintados por cima.
O resultado exportado é uma grade de caracteres que pode ser retocada à
mão no .js depois.

Cada dedo é uma camada separada para poder sumir quando é perdido.

Uso:  python tools/arte/gerar_mao.py            (gera .js e preview.png)
      python tools/arte/gerar_mao.py --preview  (só o preview)
"""

import math
import os
import sys

from PIL import Image, ImageDraw

W, H = 64, 36
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA_JS = os.path.join(RAIZ, "src", "ui", "sprites", "mao.js")
SAIDA_PNG = os.path.join(AQUI, "preview_mao.png")

# Legenda das grades:
#   .  transparente   0  contorno
#   a b c d e   pele, do mais escuro ao mais claro
#   g  hematoma   r  arranhão   n  unha
#   m M H   metal escuro / médio / brilho
TONS = "abcde"


def ruido(x, y):
    v = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - math.floor(v)


def nova_grade():
    return [["."] * W for _ in range(H)]


def tom(s, x, y, dither=0.10):
    """s em 0..1 (0 = sombra, 1 = luz) -> letra de pele, com um pouco de dither."""
    s = s + (ruido(x, y) - 0.5) * dither
    s = max(0.0, min(0.999, s))
    return TONS[int(s * len(TONS))]


def mascara():
    return Image.new("L", (W, H), 0)


def pintar_mascara(grade, masc, sombreador):
    px = masc.load()
    for y in range(H):
        for x in range(W):
            if px[x, y]:
                grade[y][x] = sombreador(x, y)


def capsula(grade, p0, p1, r0, r1, luz=1.0, base=0.5):
    """Cápsula afunilada de p0 (raio r0) a p1 (raio r1), sombreada de cima (claro) para baixo (escuro)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    comp = math.hypot(dx, dy) or 1.0
    ux, uy = dx / comp, dy / comp
    nx, ny = -uy, ux            # normal
    if ny > 0:                  # normal sempre apontando para cima (y negativo)
        nx, ny = -nx, -ny
    for y in range(H):
        for x in range(W):
            cx, cy = x + 0.5, y + 0.5
            t = ((cx - x0) * ux + (cy - y0) * uy) / comp
            tc = max(0.0, min(1.0, t))
            px, py = x0 + ux * comp * tc, y0 + uy * comp * tc
            r = r0 + (r1 - r0) * tc
            d = math.hypot(cx - px, cy - py)
            if d <= r:
                dn = (cx - px) * nx + (cy - py) * ny    # + = lado da luz
                s = base + 0.5 * (dn / r) * luz
                grade[y][x] = tom(s, x, y)


def poligono(grade, pontos, sombreador):
    masc = mascara()
    ImageDraw.Draw(masc).polygon(pontos, fill=255)
    pintar_mascara(grade, masc, sombreador)


def elipse(grade, caixa, sombreador):
    masc = mascara()
    ImageDraw.Draw(masc).ellipse(caixa, fill=255)
    pintar_mascara(grade, masc, sombreador)


def contornar(grade):
    """Pixels transparentes vizinhos (4-conexos) de pixels pintados viram contorno."""
    novos = []
    for y in range(H):
        for x in range(W):
            if grade[y][x] != ".":
                continue
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + ddx, y + ddy
                if 0 <= xx < W and 0 <= yy < H and grade[yy][xx] not in ".0":
                    novos.append((x, y))
                    break
    for x, y in novos:
        grade[y][x] = "0"


def linha(grade, p0, p1, letra, so_sobre_pele=True):
    (x0, y0), (x1, y1) = p0, p1
    n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n)
        y = round(y0 + (y1 - y0) * i / n)
        if 0 <= x < W and 0 <= y < H:
            if not so_sobre_pele or grade[y][x] in TONS + "g":
                grade[y][x] = letra


def mancha(grade, cx, cy, raio, letra, densidade=0.6):
    for y in range(H):
        for x in range(W):
            if grade[y][x] in "abc" and math.hypot(x - cx, y - cy) <= raio and ruido(x + 3, y + 7) < densidade:
                grade[y][x] = letra


def unha(grade, p_tip, direcao, tamanho=2):
    """Unha escura na ponta: os últimos `tamanho` pixels na direção do dedo."""
    ux, uy = direcao
    for y in range(H):
        for x in range(W):
            if grade[y][x] in TONS:
                proj = (x + 0.5 - p_tip[0]) * ux + (y + 0.5 - p_tip[1]) * uy
                if proj > -tamanho:
                    grade[y][x] = "n"


def direcao(p0, p1):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    c = math.hypot(dx, dy) or 1
    return dx / c, dy / c


# ---------------------------------------------------------------------
#  Camadas
# ---------------------------------------------------------------------

def camada_base():
    g = nova_grade()

    # Antebraço (sai pela direita, com a manga rasgada).
    capsula(g, (44, 16.5), (66, 15.5), 8.0, 8.5, luz=0.9, base=0.42)
    for y in range(H):
        corte = 60 + int(ruido(1, y) * 3)      # borda irregular
        for x in range(corte, W):
            g[y][x] = "."

    # Dorso da mão: quadrilátero com a fila dos nós à esquerda.
    def sombra_palma(x, y):
        s = 0.72 - (x - 20) / 26 * 0.35 - (y - 6) / 20 * 0.25
        return tom(s, x, y, dither=0.14)
    poligono(g, [(21, 6), (19, 12), (19, 19), (22, 25), (31, 29), (45, 25), (46, 9), (32, 4)], sombra_palma)

    # Nós dos dedos: pequenos relevos mais claros.
    for (kx, ky) in ((23, 8), (22, 13), (22, 18), (24, 23)):
        elipse(g, (kx - 2, ky - 1, kx + 1, ky + 1), lambda x, y: tom(0.86, x, y, 0.1))

    # Tendões no dorso.
    for x0, y0, x1, y1 in ((26, 9, 40, 11), (25, 14, 40, 14), (25, 19, 39, 18)):
        linha(g, (x0, y0), (x1, y1), "d")

    # Hematomas esverdeados.
    mancha(g, 35, 20, 3.2, "g", 0.55)
    mancha(g, 28, 22, 2.2, "g", 0.5)

    # Arranhões: X no antebraço e um risco no dorso.
    linha(g, (53, 9), (57, 13), "r")
    linha(g, (57, 9), (53, 13), "r")
    linha(g, (55, 19), (58, 22), "r")
    linha(g, (58, 18), (55, 22), "r")
    linha(g, (29, 11), (34, 15), "r")

    # Algema: anel de metal em volta do pulso, com brilho à esquerda.
    def metal(x, y):
        if x <= 46:
            return "H"
        if x <= 49:
            return "M"
        return "m"
    masc = mascara()
    ImageDraw.Draw(masc).rounded_rectangle((45, 5, 51, 27), radius=3, fill=255)
    pintar_mascara(g, masc, metal)
    for y in (6, 26):                         # rebites
        g[y][48] = "H"

    # Corrente pendurada da algema.
    for (cx, cy) in ((48, 29), (49, 32), (51, 35)):
        for ddx, ddy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            x, y = cx + ddx, cy + ddy
            if 0 <= x < W and 0 <= y < H:
                g[y][x] = "M" if ddy == -1 else "m"
        g[cy][cx] = "."                       # o furo do elo

    contornar(g)
    return g


def vinco(grade, p, direcao_dedo, raio):
    """Linha escura atravessando o dedo na articulação, para marcar a dobra."""
    ux, uy = direcao_dedo
    nx, ny = -uy, ux
    for k in range(-int(raio) - 1, int(raio) + 2):
        x = int(round(p[0] + nx * k))
        y = int(round(p[1] + ny * k))
        if 0 <= x < W and 0 <= y < H and grade[y][x] in TONS:
            grade[y][x] = "a" if grade[y][x] in "abc" else "b"


def camada_dedo(p0, p1, p2, r0, r1, r2, luz=1.0, base=0.55):
    g = nova_grade()
    capsula(g, p0, p1, r0, r1, luz, base)
    capsula(g, p1, p2, r1, r2, luz, base - 0.08)
    vinco(g, p1, direcao(p0, p1), r1 - 0.5)
    unha(g, p2, direcao(p1, p2), 2)
    contornar(g)
    return g


DEDOS = {
    # nome: (p0 na palma, p1 na dobra, p2 na ponta, raios). Pontas curvam para baixo, como garras.
    "indicador": ((23, 8), (12, 6.5), (5, 12), 3.3, 2.9, 2.2),
    "medio":     ((22, 13), (10, 14), (4, 21), 3.4, 3.0, 2.3),
    "anelar":    ((22, 18), (12, 21), (7, 28), 3.2, 2.8, 2.1),
    "minimo":    ((24, 23), (16, 26), (13, 31.5), 2.8, 2.4, 1.8),
    "polegar":   ((36, 26), (29, 30), (24, 34), 3.7, 3.1, 2.4),
}
ORDEM_DESENHO = ["minimo", "anelar", "medio", "indicador", "polegar"]


def gerar():
    camadas = {"base": camada_base()}
    for nome in ORDEM_DESENHO:
        p0, p1, p2, r0, r1, r2 = DEDOS[nome]
        camadas[nome] = camada_dedo(p0, p1, p2, r0, r1, r2)
    return camadas


# ---------------------------------------------------------------------
#  Preview e exportação
# ---------------------------------------------------------------------

PALETAS = {
    "humana": {"0": "#15111a", "a": "#4a3238", "b": "#6a4a4e", "c": "#8a6660", "d": "#a88478", "e": "#c4a08e",
               "g": "#6d6a52", "r": "#7a3540", "n": "#3a3a33", "m": "#23242a", "M": "#474a54", "H": "#7e828f"},
    "palida": {"0": "#15111a", "a": "#3c3444", "b": "#574a5c", "c": "#75657a", "d": "#8f8290", "e": "#a89ca4",
               "g": "#5e6b5a", "r": "#5c3a4a", "n": "#3a4038", "m": "#23242a", "M": "#474a54", "H": "#7e828f"},
}


def hex_para_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def compor(camadas, paleta, dedos=5, espelhar=False):
    from_ordem = ["polegar", "minimo", "anelar", "medio", "indicador"]   # ORDEM_PERDA
    perdidos = set(from_ordem[: 5 - dedos])
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()

    def pintar(grade, so_contorno=False):
        for y in range(H):
            for x in range(W):
                ch = grade[y][x]
                if ch == ".":
                    continue
                xx = W - 1 - x if espelhar else x
                if so_contorno:
                    if ch == "0" and (x + y) % 2 == 0:
                        px[xx, y] = (40, 20, 34, 140)
                    continue
                px[xx, y] = hex_para_rgb(paleta[ch]) + (255,)

    pintar(camadas["base"])
    for nome in ORDEM_DESENHO:
        pintar(camadas[nome], so_contorno=nome in perdidos)
    return img


def preview(camadas):
    escala = 6
    fundo = (30, 22, 18, 255)
    quadros = []
    for estilo in ("humana", "palida"):
        for dedos in (5, 3):
            quadros.append(compor(camadas, PALETAS[estilo], dedos, espelhar=True))
    folha = Image.new("RGBA", (W * escala * 2 + 30, H * escala * 2 + 30), fundo)
    for i, q in enumerate(quadros):
        q = q.resize((W * escala, H * escala), Image.NEAREST)
        folha.paste(q, (10 + (i % 2) * (W * escala + 10), 10 + (i // 2) * (H * escala + 10)), q)
    folha.save(SAIDA_PNG)
    print("preview:", SAIDA_PNG)


def exportar_js(camadas):
    os.makedirs(os.path.dirname(SAIDA_JS), exist_ok=True)
    linhas = [
        "// =====================================================================",
        "//  ui/sprites/mao.js — a mão em pixel art, camada por camada",
        "//",
        "//  GERADO por tools/arte/gerar_mao.py (pode ser retocado à mão aqui;",
        "//  se rodar o gerador de novo, os retoques são perdidos).",
        "//",
        "//  Legenda: . transparente  0 contorno  a..e pele (escuro -> claro)",
        "//           g hematoma  r arranhão  n unha  m/M/H metal",
        "//  Orientação original: pulso à direita, dedos para a esquerda.",
        "// =====================================================================",
        "",
        f"export const LARGURA = {W};",
        f"export const ALTURA = {H};",
        "",
        "/** Ordem de desenho (de trás para a frente). */",
        "export const ORDEM_DESENHO = " + repr(ORDEM_DESENHO).replace("'", "'") + ";",
        "",
        "export const CAMADAS = {",
    ]
    for nome in ["base"] + ORDEM_DESENHO:
        linhas.append(f"  {nome}: [")
        for row in camadas[nome]:
            linhas.append(f"    '{''.join(row)}',")
        linhas.append("  ],")
    linhas.append("};")
    linhas.append("")
    with open(SAIDA_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(linhas))
    print("js:", SAIDA_JS)


if __name__ == "__main__":
    camadas = gerar()
    preview(camadas)
    if "--preview" not in sys.argv:
        exportar_js(camadas)
