"""Les agents annoncent ce qu'ils font ; le bureau virtuel l'affiche en direct."""
import time

import requests

import config


_bureau_ouvert = False


def emit(agent: str, status: str, text: str = "", **extra) -> None:
    """status : walk (target=desk|meeting) | working | done | waiting | error"""
    global _bureau_ouvert
    try:
        requests.post(config.BUS_URL, json={"agent": agent, "status": status, "text": text[:300], **extra},
                      headers={"X-Bureau": "1"}, timeout=2)
        _bureau_ouvert = True
    except requests.RequestException:
        _bureau_ouvert = False  # le bureau est fermé : les agents continuent leur travail


def pause() -> None:
    """Laisse le temps de voir les agents marcher (seulement si le bureau est ouvert)."""
    if _bureau_ouvert and config.RYTHME > 0:
        time.sleep(config.RYTHME)
