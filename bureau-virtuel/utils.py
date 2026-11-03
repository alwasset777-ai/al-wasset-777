"""Petits outils partagés."""
import re
import urllib.parse


def normalize_phone(raw: str) -> str:
    """Met un numéro marocain au format +212XXXXXXXXX. Sinon renvoie les chiffres tels quels."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 10:
        digits = "212" + digits[1:]
    if digits.startswith("212") and len(digits) == 12:
        return "+" + digits
    return digits


def phone_valid(raw: str) -> bool:
    return bool(re.fullmatch(r"\+212[5-7]\d{8}", normalize_phone(raw)))


def whatsapp_link(phone: str, text: str) -> str:
    """Lien wa.me qui ouvre WhatsApp avec le message déjà écrit (gratuit, aucun compte API)."""
    num = normalize_phone(phone).lstrip("+")
    return f"https://wa.me/{num}?text={urllib.parse.quote(text)}"


def norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())
