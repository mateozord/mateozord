# Animações — "como funciona por dentro"

Vídeos verticais (1080×1920) em **pixel art com profundidade 3D** e **trilha lo-fi gerada por código**, sincronizada com a animação.

| Pasta | Vídeo | Duração | Composição |
|---|---|---|---|
| `maquina-de-lavar/` | Máquina de lavar (2D pixel) | 40 s | `Washer` |
| `ventilador/` | Ventilador (3D pixel) | 40 s | `Fan` |
| `gta6-ps5/` | O que o PS5 faz com o GTA 6 | 55 s | `PS5` |
| `micro-ondas/` | Micro-ondas + pipoca | 77 s | `MICRO` |

O vídeo final de cada um fica em `<pasta>/out/`.

## Como renderizar

```bash
cd animacoes
npm install                 # uma vez (dependências compartilhadas)
cd micro-ondas
npm run render              # gera o áudio e o MP4 em out/
npm run studio              # pré-visualizar no navegador
```

O 3D usa WebGL por software (`swangle`), já configurado em `remotion.config.ts`.

## Como cada vídeo funciona

- `src/timeline.ts` tem a **fonte da verdade do tempo**: 30 fps e 90 BPM, então 1 batida = 20 quadros e 1 compasso = 80 quadros. Todas as seções começam em compassos.
- `scripts/gen-audio.mjs` gera `public/soundtrack.wav` usando **os mesmos números de quadro**: lo-fi (Rhodes, baixo, bateria e chiado de vinil) mais os sons da máquina. Cada evento visual (estalo, bobina acendendo, gota, pipoca) cai numa batida ou semicolcheia e toca uma nota. Se você mudar um tempo em `timeline.ts`, mude também no script de áudio.
- `src/scene.ts` monta a cena em three.js. Renderiza em 270×480 com sombreamento toon, contorno pela profundidade e pontilhado Bayer, e depois amplia 4x sem suavizar.
- `src/ui.ts` desenha a interface em 360×640: selo de câmera lenta, medidor, contador, faixa com o número do passo, legenda extra, etiquetas com fio e onomatopeias.
- `../_shared/font.ts` é a fonte pixel 5×7 com acentos e negrito, compartilhada por todos os vídeos.

## Fazer um vídeo novo

1. Copie o projeto mais recente: `cp -r micro-ondas geladeira`. Troque o `id` em `src/Root.tsx` e os nomes em `package.json`.
2. Em `timeline.ts`: gancho de 2 s (60 quadros) e as seções em blocos de 80 quadros.
3. Em `scene.ts`: modele as peças (`rbox`, `cyl`, `wire`), use um plano de corte pra abrir a carcaça e defina as câmeras por seção em `GROUPS`.
4. Em `ui.ts`: escreva as seções (`SECS`), com uma legenda a cada ~80 quadros e no máximo 26 caracteres. As etiquetas (`LABS`) são no máximo 2 por vez, nas posições y=330 e y=470.
5. Em `gen-audio.mjs`: ajuste os tempos e os sons da máquina.

**Checklist de qualidade:** gancho forte nos 2 primeiros segundos, nada sobreposto, legendas que dão tempo de ler, uma retomada de atenção ("O MAIS INSANO VEM AGORA...") no meio e uma pergunta pra comentarem no final.
