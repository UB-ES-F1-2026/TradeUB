"""Escriptura de les dades del perfil de l'usuari autenticat."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from supabase import Client, PostgrestAPIError

from core.investor_profile import INVESTOR_QUESTIONS, calculate_investor_profile
from core.nif_nie import NIF_NIE_ERROR, is_valid_nif_nie, normalize_nif_nie
from core.onboarding import INVESTOR_PROFILE_COLUMN
from core.profiles import update_own_profile

from .deps import get_admin_client, get_current_user

router = APIRouter()

# Text obligatori: es treuen els espais dels extrems i no pot quedar buit
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class PersonalData(BaseModel):
    """Dades del pas de dades personals. Els camps són les columnes de profiles.

    Els camps que no són del model (per exemple ``id``) s'ignoren i no es desen.
    """

    nom: RequiredText
    cognoms: RequiredText
    data_naixement: date
    telefon: RequiredText
    # El format i la lletra de control es validen a l'endpoint, per poder
    # retornar el missatge exacte del 422 en lloc de la llista de Pydantic
    nif: RequiredText
    carrer: RequiredText
    codi_postal: RequiredText
    poblacio: RequiredText
    # Codi ISO 3166-1 alfa-2, com exigeix el check de la base de dades
    residencia_fiscal: Annotated[str, StringConstraints(pattern=r"^[A-Z]{2}$")]


@router.post("/personal-data")
def save_personal_data(
    data: PersonalData,
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Valida i desa les dades personals de l'usuari autenticat a profiles.

    Returns:
        ``{"perfil": ...}`` amb la fila de profiles tal com ha quedat desada.

    Raises:
        HTTPException: 422 si el NIF/NIE no és vàlid (els camps que falten o
            buits també retornen 422, amb el format de Pydantic), 404 si
            l'usuari no té fila a profiles i 500 si no s'han pogut desar.
    """
    if not is_valid_nif_nie(data.nif):
        raise HTTPException(status_code=422, detail=NIF_NIE_ERROR)

    # mode="json" converteix la data a text "AAAA-MM-DD" per enviar-la a PostgREST
    values = data.model_dump(mode="json")
    values["nif"] = normalize_nif_nie(data.nif)

    try:
        rows = update_own_profile(admin, user["sub"], values)
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'han pogut desar les dades personals"
        ) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Perfil no trobat")
    return {"perfil": rows[0]}


# Columna de profiles amb les respostes del qüestionari
# (supabase/migrations/20261109120000_profiles_investor_profile.sql)
INVESTOR_ANSWERS_COLUMN = "respostes_questionari"


class InvestorQuestionnaire(BaseModel):
    """Les 5 respostes del qüestionari: id de pregunta → id d'opció.

    Cada camp només admet les opcions de la seva pregunta, que surten de
    ``core.investor_profile.INVESTOR_QUESTIONS``. Una resposta que falta o que
    no és cap de les opcions retorna 422. Els camps que no són preguntes
    s'ignoren i no es desen.
    """

    experiencia: Literal[*INVESTOR_QUESTIONS["experiencia"]]
    coneixement: Literal[*INVESTOR_QUESTIONS["coneixement"]]
    seguiment: Literal[*INVESTOR_QUESTIONS["seguiment"]]
    caiguda: Literal[*INVESTOR_QUESTIONS["caiguda"]]
    horitzo: Literal[*INVESTOR_QUESTIONS["horitzo"]]


@router.post("/investor-questionnaire")
def save_investor_questionnaire(
    answers: InvestorQuestionnaire,
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Calcula el perfil d'inversor i el desa a profiles amb les respostes.

    El perfil sempre el calcula el servidor: el cos només porta les respostes.
    Si l'usuari ja havia respost, es sobreescriuen les respostes i el perfil.

    Returns:
        ``{"profile": "principiant" | "intermedi" | "avancat"}``.

    Raises:
        HTTPException: 422 si falta alguna resposta o no és vàlida (amb el
            format de Pydantic), 404 si l'usuari no té fila a profiles i 500
            si no s'han pogut desar.
    """
    values = answers.model_dump()
    profile = calculate_investor_profile(values)

    try:
        rows = update_own_profile(
            admin,
            user["sub"],
            {INVESTOR_ANSWERS_COLUMN: values, INVESTOR_PROFILE_COLUMN: profile},
        )
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut desar el qüestionari"
        ) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Perfil no trobat")
    return {"profile": profile}
