# -*- coding: utf-8 -*-
"""Cola dois prints lado a lado, com legenda, num arquivo so.

Usado no sub-passo 4.3 para mostrar a mesma mesa com a tensao baixa e
alta, que e como o PDF (parte B3) pede para comparar os efeitos.

    python tools/arte/comparar.py esquerda.png "legenda" direita.png "legenda" saida.png

Python so aparece nas ferramentas; o jogo continua sem dependencia.
"""
import sys
from PIL import Image, ImageDraw

ALTURA_LEGENDA = 46
ESPACO = 10


def main():
    if len(sys.argv) != 6:
        print(__doc__)
        return 2
    esq, legenda_esq, dir_, legenda_dir, saida = sys.argv[1:]

    a = Image.open(esq).convert('RGB')
    b = Image.open(dir_).convert('RGB')
    largura = a.width + b.width + ESPACO
    altura = max(a.height, b.height) + ALTURA_LEGENDA

    tela = Image.new('RGB', (largura, altura), (10, 9, 9))
    tela.paste(a, (0, ALTURA_LEGENDA))
    tela.paste(b, (a.width + ESPACO, ALTURA_LEGENDA))

    desenho = ImageDraw.Draw(tela)
    desenho.text((16, 16), legenda_esq, fill=(230, 224, 214))
    desenho.text((a.width + ESPACO + 16, 16), legenda_dir, fill=(230, 224, 214))

    tela.save(saida)
    print(f'{saida}: {largura}x{altura}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
