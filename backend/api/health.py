from fastapi import APIRouter

router = APIRouter()


@router.get("")
def health():
    """Comprovació de vida per al smoke test del desplegament."""
    return {"status": "ok"}
