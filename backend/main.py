from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import users

app = FastAPI(title="TradeUB API")

# Configuració CORS perquè el Vue s'hi pugui connectar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Posar "http://localhost:5173"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrem les rutes
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
