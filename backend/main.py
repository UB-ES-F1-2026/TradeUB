from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import users

app = FastAPI(title="TradeUB API")

# Origens permesos (producció, desenvolupament i local)
origins = [
    "https://tradeub.netlify.app",        # Frontend de producció (main)
    "https://tradeub-dev.netlify.app",    # Frontend de desenvolupament (develop)
    "http://localhost:5173",              # Local amb Vite
    "http://localhost:3000",              # Local (alternatiu)
]

# Configuració CORS perquè el Vue s'hi pugui connectar
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],                  # Permet GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],                  # Permet tots els encapçalaments (Authorization, Content-Type, etc.)
)

# Registrem les rutes
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])