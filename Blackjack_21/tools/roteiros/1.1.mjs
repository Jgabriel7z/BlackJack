// Roteiro de captura do sub-passo 1.1 — motor de regras.
// Ainda não há tela do jogo, então a evidência é a página de testes.
//
// Todo roteiro exporta default um objeto:
//   descricao  texto curto, vai para o captura.txt
//   video      false para não gravar (padrão: grava)
//   viewport   { width, height } (padrão: 1280x720)
//   executar(ctx)  recebe { abrir, print, esperar, anotar, falhar, pagina, urlBase }

export default {
  descricao: 'Página de testes do motor de regras (tests/tests.html)',
  video: true,

  async executar({ abrir, print, anotar, falhar, pagina }) {
    await abrir('/tests/tests.html');

    // Espera o resumo mudar de "Rodando..." para o resultado final.
    await pagina.waitForSelector('#resumo.tudo-ok, #resumo.tem-falha', { timeout: 10_000 });

    const texto = (await pagina.locator('#resumo').innerText()).trim();
    anotar(`resumo dos testes: ${texto}`);

    await print('testes', { paginaInteira: true });

    const falhou = (await pagina.locator('#resumo.tem-falha').count()) > 0;
    if (falhou) falhar(`Há testes falhando: ${texto}`);
  },
};
