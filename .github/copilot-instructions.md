# Instruccions de Copilot per a TradeUB

Aplica aquestes normes a totes les peticions de VS Code. El document amb el context complet del projecte és [`AGENTS.md`](../AGENTS.md).

- TradeUB és una còpia reduïda i educativa de Trade Republic, no una plataforma
  financera real.
- Backend amb Python 3.12/FastAPI; frontend amb Vue 3/Vite, Vue Router i Pinia.
- Mantén els noms del codi en anglès i la UI en català.
- No afegeixis dependències, secrets ni dades reals sense autorització explícita.
- Reutilitza les dependències d'autenticació existents i no desis secrets TOTP.
- Per a qualsevol canvi de frontend, segueix
  `.github/skills/tradeub-ui/SKILL.md`, `frontend/src/styles/tokens.css` i els
  components `Ui*`.
- No hardcodegis colors a les vistes ni creïs components visuals duplicats.
- Executa les validacions de la secció corresponent d'`AGENTS.md` i informa dels
  resultats.
- Revisa sempre el diff. Les decisions de producte, seguretat, arquitectura,
  secrets i infraestructura no es deleguen sense revisió humana.
