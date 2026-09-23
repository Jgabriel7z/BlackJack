// Testes da tensão da cena (sub-passo 4.3): a conta que o som e os
// efeitos visuais usam para saber o quanto apertar. Pura, sem navegador.

import { teste, assert, assertIgual } from './testador.js';
import { intensidadeDoPerigo, pesoDaAposta, tensaoDaCena } from '../src/ui/tensao.js';

function mesaFalsa(extra = {}) {
  const eu = { aposta: 1, dedos: 5, medidor: 0, ...(extra.eu ?? {}) };
  return { nivel: 1, serraPos: 7, ...extra, eu };
}

teste('tensão: a aposta pesa de 0 a 1', () => {
  assertIgual(pesoDaAposta(1), 0);
  assertIgual(pesoDaAposta(3), 0.5);
  assertIgual(pesoDaAposta(5), 1);
  assertIgual(pesoDaAposta(0), 0, 'abaixo da faixa não vira negativo');
  assertIgual(pesoDaAposta(50), 1, 'acima da faixa não estoura');
});

teste('tensão: no começo da partida está quase zerada', () => {
  assertIgual(tensaoDaCena(mesaFalsa()), 0);
});

teste('tensão: a aposta sozinha não passa da metade', () => {
  const soAposta = tensaoDaCena(mesaFalsa({ eu: { aposta: 5 } }));
  assert(soAposta <= 0.5, `deu ${soAposta}`);
  assert(soAposta > 0.4, `mas tem de pesar: deu ${soAposta}`);
});

teste('tensão: um passo da morte já aperta quase tudo, mesmo apostando pouco', () => {
  const quaseMorto = tensaoDaCena(mesaFalsa({ eu: { aposta: 1, dedos: 0 } }));
  assert(quaseMorto >= 0.75, `deu ${quaseMorto}`);
});

teste('tensão: aposta alta e morte perto chegam ao máximo', () => {
  assertIgual(tensaoDaCena(mesaFalsa({ eu: { aposta: 5, dedos: 0 } })), 1);
});

teste('tensão: cresce junto com a aposta, com o mesmo perigo', () => {
  const valores = [1, 2, 3, 4, 5].map((aposta) => tensaoDaCena(mesaFalsa({ eu: { aposta, dedos: 3 } })));
  for (let i = 1; i < valores.length; i++) {
    assert(valores[i] > valores[i - 1], `aposta ${i + 1} deveria apertar mais: ${valores.join(', ')}`);
  }
});

teste('tensão: cresce junto com o perigo, com a mesma aposta', () => {
  const valores = [5, 4, 3, 2, 1, 0].map((dedos) => tensaoDaCena(mesaFalsa({ eu: { aposta: 2, dedos } })));
  for (let i = 1; i < valores.length; i++) {
    assert(valores[i] > valores[i - 1], `perder dedos deveria apertar mais: ${valores.join(', ')}`);
  }
});

teste('tensão: cada nível olha o próprio aparelho', () => {
  const dedos = mesaFalsa({ nivel: 1, eu: { dedos: 1 } });
  const choque = mesaFalsa({ nivel: 2, eu: { medidor: 9 } });
  const serra = mesaFalsa({ nivel: 3, serraPos: 1 });
  for (const [nome, mesa] of [['guilhotina', dedos], ['choque', choque], ['serra', serra]]) {
    assert(intensidadeDoPerigo(mesa) >= 0.8, `${nome} perto do fim deveria apertar (deu ${intensidadeDoPerigo(mesa)})`);
  }
});

teste('tensão: sem mesa, nada', () => {
  assertIgual(tensaoDaCena(null), 0);
  assertIgual(intensidadeDoPerigo(undefined), 0);
});

teste('tensão: nunca sai da faixa de 0 a 1', () => {
  const extremos = [
    mesaFalsa({ nivel: 3, serraPos: -5, eu: { aposta: 99 } }),
    mesaFalsa({ nivel: 2, eu: { medidor: 50, aposta: -3 } }),
    mesaFalsa({ nivel: 1, eu: { dedos: -2, aposta: 5 } }),
  ];
  for (const mesa of extremos) {
    const t = tensaoDaCena(mesa);
    assert(t >= 0 && t <= 1, `saiu da faixa: ${t}`);
  }
});
