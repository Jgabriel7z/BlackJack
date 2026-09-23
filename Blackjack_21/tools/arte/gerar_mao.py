"""
gerar_mao.py — rasteriza a mão do João Gabriel em pixel art, camada por
camada, e exporta para src/ui/sprites/mao.js.

Versão 3: a mão sai da borda de baixo da tela (o antebraço é cortado
pela tela), dorso para cima, dedos apontando para o oponente e um pouco
abertos, pulso preso por uma algema de metal com corrente. Luz vinda da
lâmpada (acima e à direita da mão). Sete tons de pele com dithering nas
transições, veias, arranhões, hematomas, unhas escuras e vincos.

Cada dedo é uma camada separada para poder sumir quando é perdido.

Uso:  python tools/arte/gerar_mao.py [--preview]
"""

import math
import os
import sys

from PIL import Image, ImageDraw

W, H = 44, 64
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA_JS = os.path.join(RAIZ, "src", "ui", "sprites", "mao.js")
SAIDA_PNG = os.path.join(AQUI, "preview_mao.png")

# Legenda:
#   .  transparente   0  contorno
#   a..g   pele, do mais escuro ao mais claro (7 tons)
#   g? não: 'g' é o tom mais claro. hematoma = 'k', arranhão = 'r', unha = 'n', veia = 'v'
#   m M H   metal escuro / médio / brilho     c  couro/pano da manga
TONS = "abcdefg"
LUZ = (0.55, -0.83)   # direção da luz (para a direita e para cima), normalizada


def ruido(x, y):
    v = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - math.floor(v)


def nova_grade():
    return [["."] * W for _ in range(H)]


def tom(s, x, y, dither=0.14):
    """s em 0..1 (0 = sombra, 1 = luz). Dithering ordenado nas fronteiras dos tons."""
    padrao = ((x + y) % 2) * 0.5 - 0.25          # xadrez
    s = s + padrao * dither + (ruido(x, y) - 0.5) * dither * 0.6
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


def capsula(grade, p0, p1, r0, r1, base=0.5, forca=1.0):
    """Cápsula afunilada sombreada como um cilindro iluminado por LUZ."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    comp = math.hypot(dx, dy) or 1.0
    ux, uy = dx / comp, dy / comp
    for y in range(H):
        for x in range(W):
            cx, cy = x + 0.5, y + 0.5
            t = ((cx - x0) * ux + (cy - y0) * uy) / comp
            tc = max(0.0, min(1.0, t))
            px, py = x0 + ux * comp * tc, y0 + uy * comp * tc
            r = r0 + (r1 - r0) * tc
            ox, oy = cx - px, cy - py
            d = math.hypot(ox, oy)
            if d <= r:
                # normal aproximada do cilindro: componente perpendicular ao eixo + "altura"
                altura = math.sqrt(max(0.0, 1 - (d / r) ** 2))
                nx, ny = ox / r, oy / r
                s = base + forca * 0.5 * (nx * LUZ[0] + ny * LUZ[1]) + 0.18 * altura - 0.09
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


def linha(grade, p0, p1, letra, sobre=None):
    (x0, y0), (x1, y1) = p0, p1
    n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n)
        y = round(y0 + (y1 - y0) * i / n)
        if 0 <= x < W and 0 <= y < H and (sobre is None or grade[y][x] in sobre):
            grade[y][x] = letra


def por(grade, x, y, letra):
    if 0 <= x < W and 0 <= y < H:
        grade[y][x] = letra


def mancha(grade, cx, cy, raio, letra, densidade=0.6):
    for y in range(H):
        for x in range(W):
            if grade[y][x] in "abcd" and math.hypot(x - cx, y - cy) <= raio and ruido(x + 3, y + 7) < densidade:
                grade[y][x] = letra


def direcao(p0, p1):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    c = math.hypot(dx, dy) or 1
    return dx / c, dy / c


def unha(grade, p_tip, dir_dedo, tamanho=2.5):
    ux, uy = dir_dedo
    for y in range(H):
        for x in range(W):
            if grade[y][x] in TONS:
                proj = (x + 0.5 - p_tip[0]) * ux + (y + 0.5 - p_tip[1]) * uy
                if proj > -tamanho:
                    grade[y][x] = "n"


def vinco(grade, p, dir_dedo, raio):
    ux, uy = dir_dedo
    nx, ny = -uy, ux
    for k in range(-int(raio) - 1, int(raio) + 2):
        x = int(round(p[0] + nx * k))
        y = int(round(p[1] + ny * k))
        if 0 <= x < W and 0 <= y < H and grade[y][x] in TONS:
            i = TONS.index(grade[y][x])
            grade[y][x] = TONS[max(0, i - 2)]


# ---------------------------------------------------------------------
#  Camadas
# ---------------------------------------------------------------------

CENTRO = 21
PULSO_Y = 46


def camada_base():
    g = nova_grade()

    # Antebraço: sai por baixo da tela (linhas até H-1) e afina no pulso.
    capsula(g, (CENTRO, H + 6), (CENTRO, PULSO_Y), 9.5, 7.5, base=0.42)
    # Manga rasgada cobrindo o começo do antebraço (pano escuro com borda irregular).
    for y in range(H - 12, H):
        for x in range(W):
            if g[y][x] in TONS and y > H - 12 + int(ruido(x, 3) * 5):
                g[y][x] = "c"

    # Dorso da mão: mais largo nos nós, afinando no pulso.
    def pele_dorso(x, y):
        nx = (x - CENTRO) / 12
        s = 0.55 + 0.32 * (nx * LUZ[0]) - (y - 20) / 30 * 0.22
        return tom(s, x, y)
    poligono(g, [(CENTRO - 7, PULSO_Y), (CENTRO - 11, 34), (CENTRO - 12, 24), (CENTRO - 9, 19),
                 (CENTRO + 9, 19), (CENTRO + 12, 24), (CENTRO + 11, 34), (CENTRO + 7, PULSO_Y)], pele_dorso)

    # Nós dos dedos: relevos claros.
    for kx in (CENTRO - 9, CENTRO - 4, CENTRO + 1, CENTRO + 6):
        elipse(g, (kx - 1, 19, kx + 2, 22), lambda x, y: tom(0.9, x, y, 0.1))
    # Tendões do dorso.
    for kx in (CENTRO - 6, CENTRO - 1, CENTRO + 4):
        linha(g, (kx, 24), (kx + (1 if kx > CENTRO else -1), 40), "e", TONS)
    # Veias roxas ramificadas.
    linha(g, (CENTRO - 8, 40), (CENTRO - 4, 30), "v", TONS)
    linha(g, (CENTRO - 4, 30), (CENTRO - 2, 25), "v", TONS)
    linha(g, (CENTRO - 4, 30), (CENTRO - 7, 26), "v", TONS)
    linha(g, (CENTRO + 5, 42), (CENTRO + 3, 33), "v", TONS)
    linha(g, (CENTRO + 3, 33), (CENTRO + 6, 27), "v", TONS)
    # Hematomas e arranhões.
    mancha(g, CENTRO + 7, 36, 3.5, "k", 0.55)
    mancha(g, CENTRO - 9, 30, 2.5, "k", 0.5)
    linha(g, (CENTRO - 3, 36), (CENTRO + 3, 42), "r")
    linha(g, (CENTRO - 4, 44), (CENTRO - 1, 47), "r")

    # Algema: anel de metal no pulso, com brilho do lado da luz.
    def metal(x, y):
        if y <= PULSO_Y + 1:
            return "H"
        if y <= PULSO_Y + 4:
            return "M"
        return "m"
    masc = mascara()
    ImageDraw.Draw(masc).rounded_rectangle((CENTRO - 10, PULSO_Y, CENTRO + 10, PULSO_Y + 7), radius=3, fill=255)
    pintar_mascara(g, masc, metal)
    por(g, CENTRO - 8, PULSO_Y + 3, "H"); por(g, CENTRO + 8, PULSO_Y + 3, "H")   # rebites
    # Corrente saindo da algema para a direita (presa à mesa).
    for i, (cx, cy) in enumerate(((CENTRO + 13, PULSO_Y + 4), (CENTRO + 16, PULSO_Y + 6), (CENTRO + 19, PULSO_Y + 8))):
        for ddx, ddy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            por(g, cx + ddx, cy + ddy, "M" if ddy == -1 else "m")
    contornar(g)
    return g


def camada_dedo(p0, p1, p2, r0, r1, r2, base=0.55):
    g = nova_grade()
    capsula(g, p0, p1, r0, r1, base)
    capsula(g, p1, p2, r1, r2, base - 0.04)
    vinco(g, p1, direcao(p0, p1), r1 - 0.5)
    vinco(g, ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2), direcao(p0, p1), r1 - 1.2)
    unha(g, p2, direcao(p1, p2), 2.5)
    contornar(g)
    return g


DEDOS = {
    # nome: (base no dorso, articulação, ponta, raios) — dedos para cima, um pouco abertos e tensos
    "minimo":    ((CENTRO - 9, 21), (CENTRO - 12, 12), (CENTRO - 14, 7), 2.6, 2.3, 1.9),
    "anelar":    ((CENTRO - 4, 20), (CENTRO - 6, 9), (CENTRO - 7, 3), 3.0, 2.7, 2.2),
    "medio":     ((CENTRO + 1, 19), (CENTRO + 1, 8), (CENTRO + 1, 1), 3.1, 2.8, 2.3),
    "indicador": ((CENTRO + 6, 20), (CENTRO + 8, 10), (CENTRO + 9, 4), 3.0, 2.7, 2.2),
    "polegar":   ((CENTRO + 10, 30), (CENTRO + 15, 24), (CENTRO + 19, 19), 3.4, 3.0, 2.4),
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
    "humana": {"0": "#15111a", "a": "#3a252b", "b": "#553439", "c": "#704a4a", "d": "#8a6058", "e": "#a37866",
               "f": "#bd9178", "g": "#d4ab8e", "k": "#5d5f48", "r": "#7a3540", "n": "#3a3a33", "v": "#6a4a72",
               "m": "#23242a", "M": "#474a54", "H": "#8b8f9c", "c": "#1c1816"},
}


def hex_para_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def compor(camadas, paleta, dedos=5):
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
                if so_contorno:
                    if ch == "0" and (x + y) % 2 == 0:
                        px[x, y] = (40, 20, 34, 140)
                    continue
                px[x, y] = hex_para_rgb(paleta[ch]) + (255,)

    pintar(camadas["base"])
    for nome in ORDEM_DESENHO:
        pintar(camadas[nome], so_contorno=nome in perdidos)
    return img


def preview(camadas):
    escala = 6
    fundo = (36, 33, 29, 255)
    quadros = [compor(camadas, PALETAS["humana"], d) for d in (5, 4, 2)]
    folha = Image.new("RGBA", (W * escala * 3 + 40, H * escala + 20), fundo)
    for i, q in enumerate(quadros):
        q = q.resize((W * escala, H * escala), Image.NEAREST)
        folha.paste(q, (10 + i * (W * escala + 10), 10), q)
    folha.save(SAIDA_PNG)
    print("preview:", SAIDA_PNG)


def exportar_js(camadas):
    os.makedirs(os.path.dirname(SAIDA_JS), exist_ok=True)
    linhas = [
        "// =====================================================================",
        "//  ui/sprites/mao.js — a mão do João Gabriel em pixel art, camada por camada",
        "//",
        "//  GERADO por tools/arte/gerar_mao.py (pode ser retocado à mão aqui;",
        "//  se rodar o gerador de novo, os retoques são perdidos).",
        "//",
        "//  Legenda: . transparente  0 contorno  a..g pele (escuro -> claro)",
        "//           k hematoma  r arranhão  n unha  v veia  m/M/H metal  c manga",
        "//  Orientação: pulso embaixo (sai da tela), dedos para cima.",
        "// =====================================================================",
        "",
        f"export const LARGURA = {W};",
        f"export const ALTURA = {H};",
        f"export const LINHA_DOS_NOS = 20; // linha onde a lâmina cai (base dos dedos)",
        "",
        "/** Ordem de desenho (de trás para a frente). */",
        "export const ORDEM_DESENHO = " + repr(ORDEM_DESENHO) + ";",
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
