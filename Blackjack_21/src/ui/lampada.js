// =====================================================================
//  ui/lampada.js — balanço e piscar da lâmpada  (sub-passo 1.4)
//
//  - Balanço: soma de dois senos com períodos diferentes, para não ter
//    ritmo certinho. Ângulo pequeno, em radianos, em torno do ponto onde
//    o fio prende no teto.
//  - Piscar: episódios curtos (80–400 ms) de intensidade oscilando,
//    espaçados por 1,5 a 7 s sorteados com o gerador com seed da
//    interface. Dentro do episódio a intensidade muda a cada 40 ms com
//    um ruído fixo em função do tempo, então a mesma seed e o mesmo
//    tempo dão o mesmo piscar.
//  - `fatorTempo` (?rapido=1) encurta o intervalo entre episódios.
// =====================================================================

function ruidoFixo(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function criarLampada(rng, fatorTempo = 1) {
  const estado = {
    angulo: 0,        // radianos
    intensidade: 1,   // 0..1
    piscando: false,
  };
  let proximoEpisodio = 1500 * fatorTempo;
  let fimEpisodio = 0;

  return {
    estado,
    atualizar(agora) {
      const t = agora / 1000;
      estado.angulo = Math.sin(t * 0.7) * 0.020 + Math.sin(t * 1.63 + 1.3) * 0.009;

      if (agora >= proximoEpisodio && agora >= fimEpisodio) {
        fimEpisodio = agora + 80 + rng() * 320;
        proximoEpisodio = fimEpisodio + (1500 + rng() * 5500) * fatorTempo;
      }

      if (agora < fimEpisodio) {
        estado.piscando = true;
        estado.intensidade = 0.25 + 0.75 * ruidoFixo(Math.floor(agora / 40));
      } else {
        estado.piscando = false;
        estado.intensidade = 0.97 + 0.03 * Math.sin(t * 9); // zumbido quase imperceptível
      }
    },
  };
}
