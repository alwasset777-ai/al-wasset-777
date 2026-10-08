"""Transforme un texte affiché en texte « prononçable » pour la voix off, puis le vocalise (تشكيل) avec Mishkal.

- chiffres → lettres arabes (num2words), pourcentages, codes (W777-0001, DM-0001, agence001…), mots latins,
- symboles (← · / ⋮ «» ▼ ▲ emoji) → mots ou rien,
- vocalisation automatique (mishkal), à vérifier ensuite avec tts_check.py.

Usage : python3 speak.py "النص"   ou   from speak import speakable, diacritize
"""
import re
import sys

LATIN = [
    (r"W777-0001", "دَبْلْيُو سَبْعُمِائَةٍ وَسَبْعَةٌ وَسَبْعُونَ، صِفْرٌ صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"DM-0001", "دِي إِمْ، صِفْرٌ صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"HB-", "إِتْشْ بِي"),
    (r"NZ-", "إِنْ زِدْ"),
    (r"agence001", "أَجَانْسْ صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"W001", "دَبْلْيُو صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"B001", "بِي صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"F001", "إِفْ صِفْرٌ صِفْرٌ وَاحِدٌ"),
    (r"Google Maps", "غُوغْلْ مَابْسْ"),
    (r"PDF", "بِي دِي إِفْ"),
    (r"Word", "وُورْدْ"),
    (r"WhatsApp", "وَاتْسَابْ"),
    (r"\bX\b", "إِكْسْ"),
]
SYMBOLS = [
    ("🔥", "علامة النار"),
    ("←", "، ثم "),
    ("→", "، ثم "),
    ("⋮", "النقاط الثلاث"),
    ("«+»", "زائد"),
    ("+", " زائد "),
    ("=", " يساوي "),
    ("·", "، "),
    ("/", " أو "),
]
EMOJI = re.compile(r"[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍▲▼✦✓✔]")


def number_words(n):
    from num2words import num2words

    return num2words(int(n), lang="ar").replace("و ", "و")


def speakable(text, keep=None):
    """keep : liste où ranger les morceaux déjà vocalisés (remplacés par un caractère privé U+E000+n)."""
    s = text
    for pat, rep in LATIN:
        if keep is None:
            s = re.sub(pat, f" {rep} ", s)
        else:
            def sub(_m, rep=rep):
                keep.append(rep)
                return f" {chr(0xE000 + len(keep) - 1)} "
            s = re.sub(pat, sub, s)
    for a, b in SYMBOLS:
        s = s.replace(a, b)
    s = EMOJI.sub("", s)
    s = s.replace("«", "").replace("»", "").replace('"', "")
    s = re.sub(r"(\d+)\s*%", lambda m: number_words(m.group(1)) + " في المائة", s)
    s = re.sub(r"\d+", lambda m: number_words(m.group(0)), s)
    s = re.sub(r"\s+([،.؟!:])", r"\1", s)
    s = re.sub(r"(،\s*)+", "، ", s)
    return re.sub(r"\s+", " ", s).strip(" ،")


_mishkal = None


def diacritize(text):
    global _mishkal
    if _mishkal is None:
        import mishkal.tashkeel

        _mishkal = mishkal.tashkeel.TashkeelClass()
    # Mishkal ignore la ponctuation : on vocalise phrase par phrase en gardant les séparateurs.
    keep = []
    parts = re.split(r"([.،؟!:…—\uE000-\uE0FF])", speakable(text, keep))
    out = []
    for p in parts:
        if p and len(p) == 1 and 0xE000 <= ord(p) <= 0xE0FF:
            out.append(" " + keep[ord(p) - 0xE000] + " ")
        elif re.fullmatch(r"[.،؟!:…—]", p or ""):
            out.append(p)
        elif p.strip():
            out.append(" " + _mishkal.tashkeel(p.strip()) + " ")
    s = re.sub(r"\s+([.،؟!:…])", r"\1", "".join(out))
    return re.sub(r"\s+", " ", s).strip()


if __name__ == "__main__":
    print(diacritize(" ".join(sys.argv[1:])))
