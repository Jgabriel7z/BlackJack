// Testes da leitura de parâmetros da URL (sub-passo 1.3).

import { teste, assertIgual } from './testador.js';
import { lerParametros, FATOR_TEMPO_NORMAL, FATOR_TEMPO_RAPIDO } from '../src/ui/parametros.js';

teste('parâmetros: sem nada na URL, seed null, ritmo normal e efeitos ligados', () => {
  assertIgual(lerParametros(''), { seed: null, rapido: false, efeitos: true, fatorTempo: FATOR_TEMPO_NORMAL });
});

teste('parâmetros: ?efeitos=0 desliga o pós-processamento', () => {
  assertIgual(lerParametros('?efeitos=0').efeitos, false);
  assertIgual(lerParametros('?efeitos=1').efeitos, true);
});

teste('parâmetros: ?seed=123 vira número', () => {
  assertIgual(lerParametros('?seed=123').seed, 123);
});

teste('parâmetros: seed inválida é ignorada', () => {
  assertIgual(lerParametros('?seed=abc').seed, null);
  assertIgual(lerParametros('?seed=-5').seed, null);
});

teste('parâmetros: ?rapido=1 encurta o tempo; outro valor não', () => {
  const r = lerParametros('?seed=7&rapido=1');
  assertIgual(r.rapido, true);
  assertIgual(r.fatorTempo, FATOR_TEMPO_RAPIDO);
  assertIgual(lerParametros('?rapido=0').rapido, false);
});
