"""Escriptura de les dades del perfil de l'usuari autenticat."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator
from supabase import Client, PostgrestAPIError

from core.iban import IBAN_ERROR, is_valid_iban, mask_iban, normalize_iban
from core.investor_profile import INVESTOR_QUESTIONS, calculate_investor_profile
from core.nif_nie import NIF_NIE_ERROR, is_valid_nif_nie, normalize_nif_nie
from core.onboarding import INVESTOR_PROFILE_COLUMN, is_personal_data_completed
from core.pin import PIN_FORMAT_ERROR, hash_pin, is_valid_pin, verify_pin
from core.profile_pins import get_pin_hash, save_pin_hash
from core.profiles import (
    IBAN_COLUMN,
    get_own_profile,
    to_public_profile,
    update_own_profile,
)
from core.verification import (
    TERMS_VERSION,
    get_verification_status,
    is_identity_verified,
)

from .deps import get_admin_client, get_current_user, require_verified_user

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


class PersonalDataUpdate(BaseModel):
    """Camps editables del perfil; tots són opcionals per ser un PATCH."""

    model_config = ConfigDict(extra="allow")

    nom: RequiredText | None = None
    cognoms: RequiredText | None = None
    telefon: RequiredText | None = None
    carrer: RequiredText | None = None
    codi_postal: RequiredText | None = None
    poblacio: RequiredText | None = None

    @field_validator("nom", "cognoms", "telefon", "carrer", "codi_postal", "poblacio")
    @classmethod
    def reject_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("El camp no pot ser nul")
        return value


KYC_FIELDS_ERROR = "Les dades verificades per KYC no es poden modificar directament."


@router.post("/personal-data")
def save_personal_data(
    data: PersonalData,
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Valida i desa les dades personals de l'usuari autenticat a profiles.

    Returns:
        ``{"perfil": ...}`` amb la fila de profiles tal com ha quedat desada
        (amb l'IBAN emmascarat).

    Raises:
        HTTPException: 422 si el NIF/NIE no és vàlid (els camps que falten o
            buits també retornen 422, amb el format de Pydantic), 404 si
            l'usuari no té fila a profiles i 500 si no s'han pogut desar.
    """
    normalized_nif = normalize_nif_nie(data.nif)
    if not is_valid_nif_nie(data.nif):
        raise HTTPException(status_code=422, detail=NIF_NIE_ERROR)

    try:
        current_profile = get_own_profile(admin, user["sub"])
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'han pogut desar les dades personals"
        ) from e

    if current_profile and is_identity_verified(current_profile):
        stored_nif = normalize_nif_nie(str(current_profile.get("nif") or ""))
        stored_birth_date = str(current_profile.get("data_naixement") or "")
        if (
            normalized_nif != stored_nif
            or data.data_naixement.isoformat() != stored_birth_date
        ):
            raise HTTPException(status_code=403, detail=KYC_FIELDS_ERROR)

    # mode="json" converteix la data a text "AAAA-MM-DD" per enviar-la a PostgREST
    values = data.model_dump(mode="json")
    values["nif"] = normalized_nif

    try:
        rows = update_own_profile(admin, user["sub"], values)
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'han pogut desar les dades personals"
        ) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Perfil no trobat")
    return {"perfil": to_public_profile(rows[0])}


@router.patch("/personal-data")
def update_personal_data(
    data: PersonalDataUpdate,
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Actualitza només les dades personals editables del perfil."""
    if data.model_extra:
        raise HTTPException(status_code=403, detail=KYC_FIELDS_ERROR)

    values = data.model_dump(exclude_unset=True)
    try:
        profile = get_own_profile(admin, user["sub"])
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el perfil"
        ) from e
    if not is_personal_data_completed(profile):
        raise HTTPException(
            status_code=409,
            detail="Cal completar les dades personals de l'onboarding",
        )

    row = _save_own_profile(
        admin, user["sub"], values, "No s'han pogut actualitzar les dades personals"
    )
    # Com al POST: la fila porta la columna iban i no pot sortir sencera en una resposta
    return {"perfil": to_public_profile(row)}


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


def _save_own_profile(admin: Client, user_id: str, values: dict, error: str) -> dict:
    """Desa ``values`` a la fila de l'usuari i en retorna la fila actualitzada."""
    try:
        rows = update_own_profile(admin, user_id, values)
    except PostgrestAPIError as e:
        raise HTTPException(status_code=500, detail=error) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Perfil no trobat")
    return rows[0]


@router.post("/identity-document")
def submit_identity_document(
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Registra que l'usuari ha enviat el DNI per a la verificació simulada.

    No rep ni desa cap imatge: només el moment de l'enviament. Si ja n'havia
    enviat un, se sobreescriu i la revisió torna a començar.

    Returns:
        ``{"verificacio": ...}`` amb l'estat calculat a partir de la fila desada.

    Raises:
        HTTPException: 404 si l'usuari no té fila a profiles i 500 si no s'ha
            pogut desar.
    """
    values = {"dni_enviat_at": datetime.now(UTC).isoformat()}
    row = _save_own_profile(
        admin, user["sub"], values, "No s'ha pogut registrar l'enviament del document"
    )
    return {"verificacio": get_verification_status(row)}


class TermsAcceptance(BaseModel):
    """Versió dels termes que l'usuari ha llegit i accepta."""

    versio: RequiredText


@router.post("/terms")
def accept_terms(
    data: TermsAcceptance,
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Desa l'acceptació de la versió vigent dels termes i condicions.

    Només es poden acceptar amb la identitat ja verificada i només la versió
    vigent (``core.verification.TERMS_VERSION``).

    Returns:
        ``{"verificacio": ...}`` amb l'estat calculat a partir de la fila desada.

    Raises:
        HTTPException: 409 si la identitat no està verificada o la versió no és
            la vigent, 404 si l'usuari no té fila a profiles i 500 si no s'ha
            pogut llegir o desar el perfil.
    """
    try:
        profile = get_own_profile(admin, user["sub"])
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el perfil"
        ) from e
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no trobat")
    if not is_identity_verified(profile):
        raise HTTPException(
            status_code=409,
            detail="Cal tenir la identitat verificada per acceptar els termes",
        )
    if data.versio != TERMS_VERSION:
        raise HTTPException(
            status_code=409, detail="La versió dels termes no és la vigent"
        )

    values = {
        "termes_versio": TERMS_VERSION,
        "termes_acceptats_at": datetime.now(UTC).isoformat(),
    }
    row = _save_own_profile(
        admin, user["sub"], values, "No s'ha pogut desar l'acceptació dels termes"
    )
    return {"verificacio": get_verification_status(row)}


class IbanLink(BaseModel):
    """IBAN que l'usuari vincula per a les retirades simulades.

    El format i els dígits de control es validen a l'endpoint, per retornar el
    missatge exacte del 422 en lloc de la llista de Pydantic.
    """

    iban: str


@router.put("/iban")
def link_iban(
    data: IbanLink,
    user=Depends(require_verified_user),
    admin: Client = Depends(get_admin_client),
):
    """Vincula l'IBAN de l'usuari verificat o substitueix el que tenia (US3.3).

    Només hi ha un IBAN per usuari: si ja en tenia un, se substitueix
    directament. Es desa normalitzat (sense espais i en majúscules).

    Returns:
        ``{"iban_emmascarat": ...}``, mai l'IBAN sencer.

    Raises:
        HTTPException: 422 si l'IBAN no és un IBAN espanyol vàlid, 403 si
            l'usuari no està verificat, 404 si no té fila a profiles i 500 si
            no s'ha pogut desar.
    """
    if not is_valid_iban(data.iban):
        raise HTTPException(status_code=422, detail=IBAN_ERROR)

    iban = normalize_iban(data.iban)
    _save_own_profile(admin, user["sub"], {IBAN_COLUMN: iban}, "No s'ha pogut desar l'IBAN")
    return {"iban_emmascarat": mask_iban(iban)}


def _read_pin_hash(admin: Client, user_id: str) -> str | None:
    """Llegeix el hash del PIN i converteix els errors de la base de dades en 500."""
    try:
        return get_pin_hash(admin, user_id)
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el PIN"
        ) from e


@router.get("/pin")
def get_pin_status(
    user=Depends(get_current_user),
    admin: Client = Depends(get_admin_client),
):
    """Indica si l'usuari ja té PIN, perquè el perfil mostri "crear" o "canviar".

    No retorna mai el hash: la taula profile_pins no és llegible des del
    client. Només demana sessió, perquè la resposta no revela res.

    Returns:
        ``{"configurat": bool}``.

    Raises:
        HTTPException: 500 si no s'ha pogut llegir el PIN.
    """
    return {"configurat": _read_pin_hash(admin, user["sub"]) is not None}


class PinChange(BaseModel):
    """PIN nou i, si l'usuari ja en té, el PIN actual.

    El format es valida a l'endpoint, per retornar el missatge exacte del 422
    en lloc de la llista de Pydantic. La comprovació que el PIN nou s'ha
    escrit dues vegades igual es fa al frontend (#113).
    """

    pin: str
    pin_actual: str | None = None


@router.post("/pin")
def save_pin(
    data: PinChange,
    user=Depends(require_verified_user),
    admin: Client = Depends(get_admin_client),
):
    """Crea el PIN de seguretat o el canvia si ja en tenia (US1.5).

    Només per a usuaris verificats. Per canviar-lo cal el PIN actual; per
    crear-lo, ``pin_actual`` s'ignora. El PIN es desa només com a hash.

    Returns:
        ``{"configurat": True}``.

    Raises:
        HTTPException: 422 si el PIN nou no té 4 dígits, 403 si l'usuari no
            està verificat o el PIN actual no és correcte, i 500 si no s'ha
            pogut llegir o desar el PIN.
    """
    if not is_valid_pin(data.pin):
        raise HTTPException(status_code=422, detail=PIN_FORMAT_ERROR)

    current_hash = _read_pin_hash(admin, user["sub"])
    if current_hash is not None:
        try:
            matches = verify_pin(data.pin_actual, current_hash)
        except ValueError as e:
            raise HTTPException(
                status_code=500, detail="No s'ha pogut comprovar el PIN"
            ) from e
        if not matches:
            raise HTTPException(
                status_code=403, detail="El PIN actual és incorrecte."
            )

    try:
        save_pin_hash(admin, user["sub"], hash_pin(data.pin))
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut desar el PIN"
        ) from e
    return {"configurat": True}
