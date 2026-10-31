import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import users

app = FastAPI(title="TradeUB API")

# Configuració CORS perquè el Vue s'hi pugui connectar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrem les rutes
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])

# Puntu d'entrada per arrancar Uvicorn
if __name__ == "__main__":
    # Azure passa el port en WEBSITES_PORT o PORT; si no existeixen, usa el 8000
    port = int(os.getenv("WEBSITES_PORT", os.getenv("PORT", "8000")))
    uvicorn.run("main:app", host="0.0.0.0", port=port)