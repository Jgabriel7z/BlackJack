// Testes da leitura de parâmetros da URL (sub-passo 1.3).

import { teste, assertIgual } from './testador.js';
import { lerParametros, FATOR_TEMPO_NORMAL, FATOR_TEMPO_RAPIDO } from '../src/ui/parametros.js';

teste('parâmetros: sem nada na URL, seed null, ritmo normal e efeitos ligados', () => {
  assertIgual(lerParametros(''), {
    seed: null, rapido: false, efeitos: true, nivel: null, trunfos: null, fatorTempo: FATOR_TEMPO_NORMAL,
  });
});

teste('parâmetros: ?nivel=2 e ?nivel=3 escolhem o aparelho; valor inválido é ignorado', () => {
  assertIgual(lerParametros('?nivel=2').nivel, 2);
  assertIgual(lerParametros('?nivel=3').nivel, 3);
  assertIgual(lerParametros('?nivel=9').nivel, null);
  assertIgual(lerParametros('?nivel=abc').nivel, null);
});

teste('parâmetros: ?trunfos=... vira a mão inicial, ignorando lixo', () => {
  assertIgual(lerParametros('?trunfos=two_up,shield,go_for_24').trunfos, ['two_up', 'shield', 'go_for_24']);
  assertIgual(lerParametros('?trunfos= two_up , shield ').trunfos, ['two_up', 'shield']);
  assertIgual(lerParametros('?trunfos=<script>').trunfos, null, 'id inválido é descartado');
  assertIgual(lerParametros('?trunfos=').trunfos, null);
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
