"""Telegram (gratuit) : rapport quotidien, boutons ✅/❌ pour valider, et ordres depuis le téléphone.
Seul VOTRE compte (TELEGRAM_CHAT_ID) peut valider ou donner des ordres."""
import threading

import requests

import config

API = "https://api.telegram.org/bot{token}/{method}"


def enabled() -> bool:
    return bool(config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID)


def call(method: str, **payload) -> dict:
    r = requests.post(API.format(token=config.TELEGRAM_BOT_TOKEN, method=method), json=payload, timeout=40)
    data = r.json() if r.content else {}
    if not data.get("ok"):
        raise RuntimeError(f"Telegram {method}: {data.get('description', r.status_code)}")
    return data.get("result", {})


def send(text: str, buttons: list[list[dict]] | None = None) -> None:
    if not enabled():
        return
    for i in range(0, len(text), 4000):  # Telegram limite à 4096 caractères par message
        chunk = text[i:i + 4000]
        extra = {"reply_markup": {"inline_keyboard": buttons}} if buttons and i + 4000 >= len(text) else {}
        call("sendMessage", chat_id=config.TELEGRAM_CHAT_ID, text=chunk, disable_web_page_preview=True, **extra)


def send_approval(approval: dict) -> None:
    text = f"⏳ À VALIDER #{approval['id']} — {approval['agent']}\n{approval['title']}\n\n{approval['details'][:1500]}"
    send(text, [[{"text": "✅ Valider", "callback_data": f"ok:{approval['id']}"},
                 {"text": "❌ Refuser", "callback_data": f"no:{approval['id']}"}]])


def handle_update(update: dict, on_decision, on_order, on_command, on_bind=None) -> None:
    """Traite un message reçu. Les fonctions on_* sont fournies par le serveur."""
    owner = str(config.TELEGRAM_CHAT_ID)
    if not owner:  # mode installation : seul le bouton « ربط تيليغرام » de la page Réglages peut relier un compte
        msg = update.get("message") or {}
        chat_id = (msg.get("chat") or {}).get("id")
        if not chat_id:
            return
        import store
        code = store.kv_get("telegram_code")
        text = (msg.get("text") or "").strip()
        if code and on_bind and text == f"/start {code}":
            on_bind(chat_id)
            call("sendMessage", chat_id=chat_id, text="✅ تم ربط حسابك بالمكتب الافتراضي. ستصلك هنا التقارير وأزرار الموافقة.\n"
                                                      "اكتب /aide لمعرفة الأوامر.")
        else:
            call("sendMessage", chat_id=chat_id, text="افتح صفحة الإعدادات في المكتب الافتراضي واضغط زر «ربط تيليغرام».")
        return
    cq = update.get("callback_query")
    if cq:
        chat_id = str(((cq.get("message") or {}).get("chat") or {}).get("id", ""))
        if chat_id != owner:
            call("answerCallbackQuery", callback_query_id=cq["id"], text="Non autorisé")
            return
        action, _, aid = (cq.get("data") or "").partition(":")
        if action in ("ok", "no") and aid.isdigit():
            result = on_decision(int(aid), action == "ok", "telegram")
            call("answerCallbackQuery", callback_query_id=cq["id"], text=result[:180])
            msg = cq.get("message") or {}
            try:
                call("editMessageText", chat_id=chat_id, message_id=msg.get("message_id"),
                     text=f"{msg.get('text', '')}\n\n➡️ {result}"[:4000])
            except RuntimeError:
                pass
        return
    msg = update.get("message") or {}
    if str((msg.get("chat") or {}).get("id", "")) != owner:
        return  # on ignore les inconnus
    text = (msg.get("text") or "").strip()
    if text.startswith("/ordre"):
        order = text[len("/ordre"):].strip()
        send(on_order(order) if order else "Écrivez : /ordre votre demande")
    elif text.startswith("/"):
        send(on_command(text.split()[0]))
    elif text:
        send(on_order(text))  # un message simple = un ordre


def start_polling(on_decision, on_order, on_command, stop: threading.Event, on_bind=None) -> threading.Thread:
    """Écoute Telegram en continu (sans serveur public : pas besoin d'adresse internet)."""
    def loop():
        offset = None
        while not stop.is_set():
            try:
                updates = call("getUpdates", timeout=30, **({"offset": offset} if offset else {}),
                               allowed_updates=["message", "callback_query"])
                for u in updates:
                    offset = u["update_id"] + 1
                    try:
                        handle_update(u, on_decision, on_order, on_command, on_bind)
                    except Exception as e:  # un message raté ne doit pas arrêter l'écoute
                        print("Telegram: erreur de traitement", e)
            except Exception as e:
                print("Telegram: connexion perdue, nouvel essai dans 10 s", e)
                stop.wait(10)
    t = threading.Thread(target=loop, name="telegram", daemon=True)
    t.start()
    return t
