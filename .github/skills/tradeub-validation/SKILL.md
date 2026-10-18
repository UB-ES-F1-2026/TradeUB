---
name: tradeub-validation
description: Executa i interpreta les validacions de backend i frontend de TradeUB abans d'un PR.
---

# Validació de TradeUB

Fes servir aquesta skill quan una tasca demani comprovar qualitat, preparar un
PR o investigar una fallada de CI.

## Procediment

1. Determina si el canvi afecta `backend`, `frontend` o tots dos.
2. Des de `backend\`, executa:

   ```powershell
   python -m compileall -q .
   python -m ruff check .
   pytest
   ```

3. Des de `frontend\`, executa:

   ```powershell
   npm run lint
   npm run build
   npm test
   ```

4. Si una ordre falla, mostra l'error rellevant, corregeix només allò
   relacionat amb la tasca i repeteix la validació.
5. Reporta les ordres executades, el resultat i qualsevol test omès o limitació.

No instal·lis dependències ni modifiquis la CI per ocultar una fallada.
