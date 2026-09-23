"""
gerar_luiz.py — rasteriza o Luiz Alberto em pixel art e exporta para
src/ui/sprites/luiz.js.

Referência do grupo: homem magro e doente sentado do outro lado da mesa,
cabelo cacheado escuro e desgrenhado, rosto encovado com um olho
esbranquiçado, pele cinza-esverdeada com veias, camiseta escura rasgada
e manchada, braços marcados, as duas mãos espalmadas na mesa.
Sem sangue: as manchas são de sujeira, os arranhões são linhas escuras.

Camadas exportadas (grade 112 x 64; a borda da mesa passa na linha 46):
  corpo            tronco, camiseta, pescoço, braços até o cotovelo
                   (desenhado ANTES do tampo da mesa)
  cabeca_<quadro>  cabeça em 6 quadros: neutra / esq / dir, com olhos
                   abertos ou fechados (_piscando)
  antebracos       antebraços e a mão esquerda (desenhados DEPOIS do tampo)
  mao_dir_base     palma da mão direita, a que está em jogo (com algema)
  mao_dir_<dedo>   cada dedo da mão direita, para sumir quando perdido

Uso:  python tools/arte/gerar_luiz.py [--preview]
"""

import math
import os
import sys

from PIL import Image, ImageDraw

W, H = 112, 64
CX = 56                      # centro do personagem
LINHA_DA_MESA = 46           # linhas >= esta ficam atrás do tampo
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SAIDA_JS = os.path.join(RAIZ, "src", "ui", "sprites", "luiz.js")
SAIDA_PNG = os.path.join(AQUI, "preview_luiz.png")

TONS = "abcde"               # pele, do escuro ao claro
TONS_CAMISA = "qpt"          # camiseta, do escuro ao claro

PALETA = {
    "0": "#121014",
    # pele cinza-esverdeada
    "a": "#4b514a", "b": "#667063", "c": "#838c7d", "d": "#9ea896", "e": "#b7bfae",
    "v": "#5b4a6a",   # veia
    "r": "#6e3f4a",   # arranhão / cicatriz
    "k": "#2c2833",   # órbita fundo
    "u": "#4a3f55",   # olheira
    "w": "#c8c6bb",   # olho esbranquiçado
    "i": "#2a2f33",   # íris / pupila
    "n": "#3a3d36",   # unha
    "m": "#2a2225",   # boca
    "h": "#1d1a1b",   # cabelo
    "j": "#38302e",   # brilho do cabelo
    # camiseta
    "q": "#2b2d27", "p": "#3b3e34", "t": "#4c5044",
    "x": "#211f1e",   # mancha de sujeira
    # algema
    "z": "#23242a", "Z": "#474a54", "y": "#7e828f",
}


def ruido(x, y):
    v = math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return v - math.floor(v)


def nova_grade():
    return [["."] * W for _ in range(H)]


def tom(s, x, y, letras=TONS, dither=0.10):
    s = s + (ruido(x, y) - 0.5) * dither
    s = max(0.0, min(0.999, s))
    return letras[int(s * len(letras))]


def mascara():
    return Image.new("L", (W, H), 0)


def pintar_mascara(grade, masc, sombreador):
    px = masc.load()
    for y in range(H):
        for x in range(W):
            if px[x, y]:
                grade[y][x] = sombreador(x, y)


def poligono(grade, pontos, sombreador):
    masc = mascara()
    ImageDraw.Draw(masc).polygon(pontos, fill=255)
    pintar_mascara(grade, masc, sombreador)


def elipse(grade, caixa, sombreador):
    masc = mascara()
    ImageDraw.Draw(masc).ellipse(caixa, fill=255)
    pintar_mascara(grade, masc, sombreador)


def capsula(grade, p0, p1, r0, r1, letras=TONS, luz=1.0, base=0.5):
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    comp = math.hypot(dx, dy) or 1.0
    ux, uy = dx / comp, dy / comp
    nx, ny = -uy, ux
    if nx > 0 or (nx == 0 and ny > 0):   # normal apontando para a esquerda/cima (lado da luz)
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
                dn = (cx - px) * nx + (cy - py) * ny
                s = base + 0.5 * (dn / r) * luz
                grade[y][x] = tom(s, x, y, letras)


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


# ---------------------------------------------------------------------
#  Cabeça (rosto 22 x 24, pescoço até a linha 34)
# ---------------------------------------------------------------------

PESCOCO = (CX, 33)           # pivô da rotação


def camada_cabeca(olhos_abertos=True):
    g = nova_grade()
    topo, queixo = 6, 30
    olhos_y = 16

    def pele_rosto(x, y):
        s = 0.66 - (x - (CX - 8)) / 20 * 0.38 - (y - topo) / 24 * 0.18
        if abs(x - CX) >= 6 and 17 <= y <= 25:        # bochechas encovadas
            s -= 0.24
        if 26 <= y <= 29 and abs(x - CX) <= 3:          # queixo pontudo em sombra
            s -= 0.1
        return tom(s, x, y, dither=0.12)

    poligono(g, [(CX - 10, 12), (CX - 11, 18), (CX - 9, 25), (CX - 5, queixo), (CX + 5, queixo),
                 (CX + 9, 25), (CX + 11, 18), (CX + 10, 12), (CX + 6, topo + 1), (CX - 6, topo + 1)], pele_rosto)

    # Pescoço fino com tendões.
    poligono(g, [(CX - 4, 28), (CX + 4, 28), (CX + 5, 35), (CX - 5, 35)],
             lambda x, y: tom(0.42 - (x - CX) / 12, x, y))
    linha(g, (CX - 2, 30), (CX - 2, 34), "b", TONS)
    linha(g, (CX + 2, 30), (CX + 2, 34), "b", TONS)

    # Olheiras fundas e órbitas.
    for ox in (CX - 6, CX + 2):
        for dx in range(0, 5):
            for dy in range(-1, 3):
                por(g, ox + dx, olhos_y + dy, "u")
        for dx in range(0, 5):
            por(g, ox + dx, olhos_y, "k")
            por(g, ox + dx, olhos_y + 1, "k")

    if olhos_abertos:
        # Esquerdo (do observador): esbranquiçado, sem pupila.
        for dx in range(1, 4):
            por(g, CX - 6 + dx, olhos_y, "w")
            por(g, CX - 6 + dx, olhos_y + 1, "w")
        por(g, CX - 4, olhos_y + 1, "d")
        # Direito: com pupila escura.
        for dx in range(1, 4):
            por(g, CX + 2 + dx, olhos_y, "w")
            por(g, CX + 2 + dx, olhos_y + 1, "w")
        por(g, CX + 4, olhos_y, "i")
        por(g, CX + 4, olhos_y + 1, "i")
    else:
        for ox in (CX - 6, CX + 2):
            for dx in range(1, 4):
                por(g, ox + dx, olhos_y + 1, "m")

    # Sobrancelhas caídas, nariz fino, boca virada para baixo.
    linha(g, (CX - 7, olhos_y - 3), (CX - 2, olhos_y - 2), "b", TONS)
    linha(g, (CX + 2, olhos_y - 2), (CX + 7, olhos_y - 3), "b", TONS)
    linha(g, (CX, olhos_y), (CX - 1, olhos_y + 6), "b", TONS)
    por(g, CX - 2, olhos_y + 6, "a"); por(g, CX + 1, olhos_y + 6, "a")
    linha(g, (CX - 4, 26), (CX + 4, 26), "m")
    por(g, CX - 5, 27, "m"); por(g, CX + 5, 27, "m")
    # Cicatriz na bochecha, veias na têmpora e no pescoço.
    linha(g, (CX - 9, 19), (CX - 7, 24), "r")
    linha(g, (CX + 8, 10), (CX + 9, 15), "v", TONS)
    linha(g, (CX + 3, 31), (CX + 4, 34), "v", TONS)

    # Cabelo cacheado, desgrenhado, caindo na testa e nas laterais.
    def cabelo(x, y):
        return "j" if ruido(x * 3, y * 7) < 0.18 else "h"
    poligono(g, [(CX - 12, 11), (CX - 12, 5), (CX - 7, 1), (CX + 7, 1), (CX + 12, 5), (CX + 13, 11),
                 (CX + 10, 10), (CX + 7, 8), (CX - 7, 8), (CX - 10, 11)], cabelo)
    for (bx, by, rr) in ((CX - 12, 7, 2), (CX - 9, 3, 2), (CX - 4, 1, 2), (CX + 1, 0, 2), (CX + 6, 1, 2),
                         (CX + 10, 3, 2), (CX + 13, 8, 2), (CX + 13, 12, 1), (CX - 13, 12, 1),
                         (CX - 12, 15, 1), (CX + 13, 16, 1), (CX - 12, 18, 1)):
        elipse(g, (bx - rr, by - rr, bx + rr, by + rr), cabelo)
    linha(g, (CX - 7, 8), (CX - 6, 12), "h")
    linha(g, (CX - 3, 8), (CX - 2, 11), "h")
    linha(g, (CX + 2, 8), (CX + 3, 12), "h")
    linha(g, (CX + 6, 8), (CX + 7, 11), "h")
    linha(g, (CX - 11, 11), (CX - 10, 20), "h")
    linha(g, (CX + 11, 11), (CX + 11, 21), "h")

    contornar(g)
    return g


def rotacionar(grade, graus):
    """Gira a grade em torno do pescoço, sem suavização (mantém os pixels)."""
    img = Image.new("L", (W, H), 0)
    px = img.load()
    codigo = {ch: i + 1 for i, ch in enumerate(PALETA)}
    inverso = {v: k for k, v in codigo.items()}
    for y in range(H):
        for x in range(W):
            if grade[y][x] != ".":
                px[x, y] = codigo[grade[y][x]]
    img = img.rotate(graus, resample=Image.NEAREST, center=PESCOCO)
    px = img.load()
    g = nova_grade()
    for y in range(H):
        for x in range(W):
            if px[x, y]:
                g[y][x] = inverso[px[x, y]]
    return g


# ---------------------------------------------------------------------
#  Corpo (antes da mesa)
# ---------------------------------------------------------------------

OMBRO_Y = 36
COTOVELO_ESQ = (CX - 27, 50)
COTOVELO_DIR = (CX + 27, 50)


def camada_corpo():
    g = nova_grade()

    def camisa(x, y):
        s = 0.6 - (x - (CX - 22)) / 46 * 0.4 - (y - OMBRO_Y) / 26 * 0.25
        return tom(s, x, y, TONS_CAMISA, dither=0.2)

    # Camiseta larga, ombros caídos, até bem abaixo da borda da mesa.
    poligono(g, [(CX - 24, OMBRO_Y + 2), (CX - 19, OMBRO_Y - 2), (CX - 7, OMBRO_Y - 4), (CX + 7, OMBRO_Y - 4),
                 (CX + 19, OMBRO_Y - 2), (CX + 24, OMBRO_Y + 2), (CX + 21, H - 1), (CX - 21, H - 1)], camisa)
    # Gola frouxa mostrando o pescoço/peito.
    poligono(g, [(CX - 7, OMBRO_Y - 4), (CX + 7, OMBRO_Y - 4), (CX + 3, OMBRO_Y + 2), (CX - 3, OMBRO_Y + 2)],
             lambda x, y: tom(0.42 - (x - CX) / 10, x, y))
    linha(g, (CX - 1, OMBRO_Y - 1), (CX, OMBRO_Y + 1), "b", TONS)
    # Dobras da camiseta.
    for i in range(4):
        y0 = OMBRO_Y + 4 + i * 3
        linha(g, (CX - 12 + i, y0), (CX - 4 + i, y0 + 4), "q", TONS_CAMISA)
    # Mangas curtas e braços até o cotovelo.
    capsula(g, (CX - 22, OMBRO_Y), (CX - 26, OMBRO_Y + 8), 4.6, 4.0, TONS_CAMISA, base=0.55)
    capsula(g, (CX + 22, OMBRO_Y), (CX + 26, OMBRO_Y + 8), 4.6, 4.0, TONS_CAMISA, base=0.35)
    capsula(g, (CX - 25, OMBRO_Y + 7), COTOVELO_ESQ, 3.6, 3.1, base=0.52)
    capsula(g, (CX + 25, OMBRO_Y + 7), COTOVELO_DIR, 3.6, 3.1, base=0.36)

    # Rasgos na camiseta mostrando pele.
    for (rx, ry, rw, rh) in ((CX - 15, OMBRO_Y + 3, 5, 3), (CX + 11, OMBRO_Y + 8, 6, 3),
                             (CX - 6, OMBRO_Y + 14, 4, 2), (CX + 4, OMBRO_Y + 20, 5, 3)):
        for dx in range(rw):
            alt = rh - (1 if dx in (0, rw - 1) else 0)
            for dy in range(alt):
                if g[ry + dy][rx + dx] in TONS_CAMISA:
                    por(g, rx + dx, ry + dy, tom(0.3 + dy * 0.05, rx + dx, ry + dy))
        for dx in range(-1, rw + 1):
            if g[ry - 1][rx + dx] in TONS_CAMISA:
                por(g, rx + dx, ry - 1, "q")
    # Manchas escuras de sujeira.
    for (mx, my, mr) in ((CX - 9, OMBRO_Y + 9, 3.2), (CX + 7, OMBRO_Y + 4, 2.2), (CX + 1, OMBRO_Y + 16, 3.5),
                         (CX - 16, OMBRO_Y + 12, 2.0)):
        for y in range(H):
            for x in range(W):
                if g[y][x] in TONS_CAMISA and math.hypot(x - mx, y - my) <= mr and ruido(x + 9, y + 1) < 0.7:
                    g[y][x] = "x"
    # Veias e arranhões nos braços.
    linha(g, (CX - 25, OMBRO_Y + 9), (CX - 27, OMBRO_Y + 14), "v", TONS)
    linha(g, (CX - 26, OMBRO_Y + 11), (CX - 24, OMBRO_Y + 13), "v", TONS)
    linha(g, (CX + 25, OMBRO_Y + 8), (CX + 28, OMBRO_Y + 13), "v", TONS)
    linha(g, (CX + 27, OMBRO_Y + 10), (CX + 29, OMBRO_Y + 11), "r", TONS)

    contornar(g)
    return g


# ---------------------------------------------------------------------
#  Antebraços e mãos (depois da mesa)
# ---------------------------------------------------------------------

PULSO_ESQ = (CX - 20, 56)
PULSO_DIR = (CX + 20, 56)
MAO_ESQ_CENTRO = (CX - 18, 58)
MAO_DIR_CENTRO = (CX + 18, 58)   # palma da mão em jogo


def antebraco(g, cotovelo, pulso, base):
    capsula(g, cotovelo, pulso, 3.4, 2.9, base=base)
    mx, my = (cotovelo[0] + pulso[0]) // 2, (cotovelo[1] + pulso[1]) // 2
    linha(g, (mx - 2, my - 2), (mx + 2, my + 2), "v", TONS)
    linha(g, (mx, my - 1), (mx + 1, my + 3), "v", TONS)
    linha(g, (mx - 3, my + 1), (mx - 1, my + 3), "r", TONS)


def palma(g, centro, base):
    px, py = centro
    poligono(g, [(px - 5, py - 3), (px + 5, py - 3), (px + 6, py + 2), (px - 6, py + 2)],
             lambda x, y: tom(base - (y - py) / 9, x, y))
    linha(g, (px - 3, py - 2), (px + 2, py), "v", TONS)
    linha(g, (px - 4, py + 1), (px - 2, py + 1), "b", TONS)
    linha(g, (px + 1, py + 1), (px + 3, py + 1), "b", TONS)


def dedos_para_baixo(centro):
    px, py = centro
    return {
        "minimo": (px + 5, 3),
        "anelar": (px + 2, 4),
        "medio": (px - 1, 4),
        "indicador": (px - 4, 3),
    }


def desenhar_dedo(g, centro, nome, base, lado):
    px, py = centro
    if nome == "polegar":
        s = 1 if lado == "dir" else -1
        capsula(g, (px + 6 * s, py - 1), (px + 9 * s, py + 2), 1.5, 1.1, base=base)
        por(g, px + 9 * s, py + 2, "n")
    else:
        fx, comp = dedos_para_baixo(centro)[nome]
        capsula(g, (fx, py + 2), (fx + 0.4, py + 2 + comp), 1.3, 1.0, base=base)
        por(g, fx, py + 2 + comp, "n")


def camada_antebracos():
    g = nova_grade()
    antebraco(g, COTOVELO_ESQ, PULSO_ESQ, 0.52)
    antebraco(g, COTOVELO_DIR, PULSO_DIR, 0.38)
    palma(g, MAO_ESQ_CENTRO, 0.55)
    for nome in ("minimo", "anelar", "medio", "indicador", "polegar"):
        desenhar_dedo(g, MAO_ESQ_CENTRO, nome, 0.5, "esq")
    contornar(g)
    return g


def camada_mao_dir_base():
    g = nova_grade()
    palma(g, MAO_DIR_CENTRO, 0.42)
    # Algema no pulso, com brilho à esquerda, e um elo de corrente caindo.
    px, py = PULSO_DIR
    for dy in range(-3, 3):
        por(g, px - 2, py + dy - 1, "y" if dy < 0 else "Z")
        por(g, px - 1, py + dy - 1, "Z")
        por(g, px, py + dy - 1, "z")
    por(g, px - 1, py + 2, "z"); por(g, px, py + 3, "Z"); por(g, px + 1, py + 4, "z")
    contornar(g)
    return g


def camada_dedo_dir(nome):
    g = nova_grade()
    desenhar_dedo(g, MAO_DIR_CENTRO, nome, 0.4, "dir")
    contornar(g)
    return g


ORDEM_DEDOS = ["minimo", "anelar", "medio", "indicador", "polegar"]


# ---------------------------------------------------------------------
#  Geração, preview e exportação
# ---------------------------------------------------------------------

def gerar():
    camadas = {"corpo": camada_corpo(), "antebracos": camada_antebracos(),
               "mao_dir_base": camada_mao_dir_base()}
    for nome in ORDEM_DEDOS:
        camadas[f"mao_dir_{nome}"] = camada_dedo_dir(nome)
    aberta = camada_cabeca(True)
    fechada = camada_cabeca(False)
    for sufixo, graus in (("neutra", 0), ("esq", 7), ("dir", -7)):
        camadas[f"cabeca_{sufixo}"] = rotacionar(aberta, graus) if graus else aberta
        camadas[f"cabeca_{sufixo}_piscando"] = rotacionar(fechada, graus) if graus else fechada
    return camadas


def hex_para_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def compor(camadas, cabeca="cabeca_neutra", dedos=5, mostrar_mesa=True):
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
                px[x, y] = hex_para_rgb(PALETA[ch]) + (255,)

    pintar(camadas["corpo"])
    pintar(camadas[cabeca])
    if mostrar_mesa:
        for y in range(LINHA_DA_MESA, H):
            for x in range(W):
                px[x, y] = (43, 26, 18, 255)
    pintar(camadas["antebracos"])
    pintar(camadas["mao_dir_base"])
    perdidos = set(["polegar", "minimo", "anelar", "medio", "indicador"][: 5 - dedos])
    for nome in ORDEM_DEDOS:
        pintar(camadas[f"mao_dir_{nome}"], so_contorno=nome in perdidos)
    return img


def preview(camadas):
    escala = 4
    quadros = [compor(camadas, "cabeca_neutra", 5), compor(camadas, "cabeca_esq", 5),
               compor(camadas, "cabeca_dir_piscando", 3), compor(camadas, "cabeca_neutra_piscando", 1)]
    folha = Image.new("RGBA", (W * escala * 2 + 30, H * escala * 2 + 30), (8, 6, 6, 255))
    for i, q in enumerate(quadros):
        q = q.resize((W * escala, H * escala), Image.NEAREST)
        folha.paste(q, (10 + (i % 2) * (W * escala + 10), 10 + (i // 2) * (H * escala + 10)), q)
    folha.save(SAIDA_PNG)
    print("preview:", SAIDA_PNG)


def exportar_js(camadas):
    os.makedirs(os.path.dirname(SAIDA_JS), exist_ok=True)
    linhas = [
        "// =====================================================================",
        "//  ui/sprites/luiz.js — o Luiz Alberto em pixel art, em camadas e quadros",
        "//",
        "//  GERADO por tools/arte/gerar_luiz.py (retoques à mão aqui são perdidos",
        "//  se o gerador rodar de novo).",
        "//",
        "//  Camadas: corpo (antes da mesa), cabeca_<neutra|esq|dir>[_piscando],",
        "//  antebracos (depois da mesa), mao_dir_base e mao_dir_<dedo>.",
        "// =====================================================================",
        "",
        f"export const LARGURA = {W};",
        f"export const ALTURA = {H};",
        f"export const LINHA_DA_MESA = {LINHA_DA_MESA}; // linhas >= esta ficam atrás do tampo",
        f"export const PESCOCO = {{ x: {PESCOCO[0]}, y: {PESCOCO[1]} }};",
        f"export const MAO_DIREITA = {{ x: {MAO_DIR_CENTRO[0]}, y: {MAO_DIR_CENTRO[1]} }};",
        f"export const ORDEM_DEDOS = {ORDEM_DEDOS!r};",
        "",
        "export const PALETA = {",
    ]
    for k, v in PALETA.items():
        linhas.append(f"  '{k}': '{v}',")
    linhas.append("};")
    linhas.append("")
    linhas.append("export const CAMADAS = {")
    for nome, grade in camadas.items():
        linhas.append(f"  {nome}: [")
        for row in grade:
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
