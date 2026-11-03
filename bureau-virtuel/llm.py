"""Cerveau des agents : Gemini (offre gratuite) → Ollama sur l'ordinateur (gratuit) → mode démo."""
import json
import re

import requests

import config


class LLMError(RuntimeError):
    pass


def _gemini(system: str, prompt: str, json_mode: bool) -> str:
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": config.GEMINI_API_KEY}, json=body, timeout=90)
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def _ollama(system: str, prompt: str, json_mode: bool) -> str:
    r = requests.post(f"{config.OLLAMA_URL.rstrip('/')}/api/chat", timeout=300, json={
        "model": config.OLLAMA_MODEL, "stream": False, **({"format": "json"} if json_mode else {}),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]})
    r.raise_for_status()
    return r.json()["message"]["content"]


def available() -> bool:
    return bool(config.GEMINI_API_KEY or config.OLLAMA_URL)


def ask(system: str, prompt: str, json_mode: bool = False) -> str:
    errors = []
    if config.GEMINI_API_KEY:
        try:
            return _gemini(system, prompt, json_mode)
        except Exception as e:  # quota dépassé, coupure… on tente le secours
            errors.append(f"Gemini: {e}")
    if config.OLLAMA_URL:
        try:
            return _ollama(system, prompt, json_mode)
        except Exception as e:
            errors.append(f"Ollama: {e}")
    if errors:
        raise LLMError(" | ".join(errors)[:500])
    raise LLMError("Aucune IA configurée (mode démo)")


def parse_json(text: str):
    """Lit du JSON même entouré de ```json ... ``` ou de texte."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if m:
            return json.loads(m.group(1))
        raise


def ask_json(system: str, prompt: str, fallback):
    """Demande une réponse JSON. En mode démo ou en cas d'erreur, renvoie `fallback`."""
    if not available():
        return fallback
    try:
        return parse_json(ask(system, prompt, json_mode=True))
    except Exception:
        return fallback
