# Contexto do projeto

Preferência: respostas curtas, economizar tokens. Idioma: português.

## Repo
- `animacoes/`: vídeos explicativos em pixel art 3D (Remotion + three.js, lo-fi procedural).
  - `_shared/` (deps e fonte pixel comuns), `gta6-ps5/`, `maquina-de-lavar/`, `micro-ondas/`, `ventilador/`.
- Branch de trabalho: `claude/lofi-animations-sync-ugb0i1` (já com push).

## Habblaud (multi-agentes)
- https://github.com/marmottajr/habblaud: escritório virtual em pixel art dos agentes do Claude Code.
- Roda **na máquina local** (lê `~/.claude`), não na sessão cloud.
- Instalação: `git clone ... && cd habblaud && npm install && npm run docker:up` (ou `npm run build && npm start`),
  depois `npm run mod:install`; abrir http://localhost:4747 e `/reload-plugins` nas sessões abertas.
- Status: ainda não instalado no PC do usuário.
