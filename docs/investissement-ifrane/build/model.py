"""Modèle financier unique des trois scénarios (Ifrane, 7 ha).

Toutes les versions linguistiques lisent ces mêmes chiffres : une seule source de vérité.
Montants en millions de dirhams (M MAD), prix constants + indexation explicite.
"""

EUR_MAD = 10.8          # hypothèse de change (1 EUR = 10,8 MAD)
LAND_M2 = 70_000
LAND_PRICE_M2 = 500     # MAD/m², valeur d'apport hypothétique, à confirmer par expertise
LAND_VALUE = LAND_M2 * LAND_PRICE_M2 / 1e6   # 35 M MAD
DISCOUNT = 0.10
START_YEAR = 2027


def irr(flows):
    lo, hi = -0.99, 1.0
    f = lambda r: sum(cf / (1 + r) ** i for i, cf in enumerate(flows))
    if f(lo) * f(hi) > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def npv(rate, flows):
    return sum(cf / (1 + rate) ** i for i, cf in enumerate(flows))


def payback(flows, years):
    cum = 0
    for i, cf in enumerate(flows):
        prev = cum
        cum += cf
        if cum >= 0 and i > 0:
            frac = -prev / cf if cf else 0
            return years[i - 1] + frac, i - 1 + frac   # année civile, durée depuis le 1er décaissement
    return None, None


# ---------------------------------------------------------------- hôtellerie (A et C)
def hotel_model(p, adr_mult=1.0, occ_delta=0.0, capex_mult=1.0):
    capex_items = p["capex"]
    capex_ex_land = sum(v for k, v in capex_items if k != "land") * capex_mult
    capex_total = capex_ex_land + LAND_VALUE
    # calendrier des décaissements : 2027 terrain + études, 2028 et 2029 travaux
    phasing = p["capex_phasing"]
    years_build = [START_YEAR + i for i in range(len(phasing))]
    ops_years = [years_build[-1] + 1 + i for i in range(20)]
    rows = []
    for i, y in enumerate(ops_years):
        occ = min(p["occ"][min(i, len(p["occ"]) - 1)] + occ_delta, 0.85)
        adr = p["adr0"] * adr_mult * (1 + p["adr_growth"]) ** i
        room_nights = p["keys"] * 365 * occ
        rooms_rev = room_nights * adr / 1e6
        total_rev = rooms_rev / p["rooms_share"]
        gop_m = p["gop"][min(i, len(p["gop"]) - 1)]
        gop = total_rev * gop_m
        fees = total_rev * 0.03 + gop * 0.08
        fixed = total_rev * p["fixed_pct"]
        ffe = total_rev * (0.02 if i == 0 else 0.03 if i == 1 else 0.04)
        ebitda = gop - fees - fixed - ffe
        rows.append(dict(year=y, occ=occ, adr=adr, rooms_rev=rooms_rev, total_rev=total_rev,
                         opex=total_rev - gop, gop=gop, fees=fees + fixed + ffe, ebitda=ebitda))
    flows = []
    for i, ph in enumerate(phasing):
        out = capex_ex_land * ph + (LAND_VALUE if i == 0 else 0)
        flows.append(-out)
    for r in rows:
        flows.append(r["ebitda"])
    resi = p.get("resi")
    resi_sales = resi_cost = 0.0
    if resi:
        resi_sales = resi["n"] * resi["price"] * adr_mult
        resi_cost = resi["n"] * resi["unit_cost"] * capex_mult + resi_sales * 0.05
        for i in range(len(flows)):
            flows[i] += resi_sales * resi["sales_ph"][i] - resi_cost * resi["cost_ph"][i]
    long_flows = flows[:]              # 20 ans d'exploitation, sans revente : sert au délai de récupération
    long_years = years_build + ops_years
    rows = rows[:10]
    ops_years = ops_years[:10]
    flows = flows[:len(years_build) + 10]
    exit_value = rows[-1]["ebitda"] * (1 + p["adr_growth"]) / p["exit_cap"]
    flows_exit = flows[:]
    flows_exit[-1] += exit_value * 0.98  # frais de cession 2 %
    years = years_build + ops_years
    stab = rows[3]
    pb_year, pb_dur = payback(long_flows, long_years)
    return dict(capex_total=capex_total, capex_ex_land=capex_ex_land, rows=rows, flows=flows,
                resi_sales=resi_sales, resi_cost=resi_cost, resi_margin=resi_sales - resi_cost,
                net_equity_need=capex_total - (resi_sales - resi_cost),
                flows_exit=flows_exit, years=years, exit_value=exit_value,
                irr=irr(flows_exit), npv=npv(DISCOUNT, flows_exit), payback_year=pb_year,
                payback_dur=pb_dur, stab=stab, yield_on_cost=stab["ebitda"] / capex_total,
                per_key=capex_ex_land / p["keys"])


RESI_SALES_PH = [0, 0.20, 0.35, 0.30, 0.15] + [0] * 30   # encaissements VEFA 2027→2031
RESI_COST_PH = [0.05, 0.40, 0.45, 0.10] + [0] * 30

A = dict(
    code="A", keys=40, adr0=3900, adr_growth=0.035,
    occ=[0.40, 0.50, 0.56, 0.60], gop=[0.25, 0.32, 0.36, 0.38], rooms_share=0.52,
    fixed_pct=0.025, exit_cap=0.085, capex_phasing=[0.10, 0.45, 0.45],
    gfa=9_000,
    capex=[("land", LAND_VALUE), ("construction", 9_000 * 13_000 / 1e6), ("infra", 24.0),
           ("ffe", 28.0), ("soft", 15.0), ("preopen", 9.0), ("contingency", 13.5)],
    resi=dict(n=14, price=6.2, unit_cost=2.72, area=260, sales_ph=RESI_SALES_PH, cost_ph=RESI_COST_PH),
)

C = dict(
    code="C", keys=40, adr0=7000, adr_growth=0.035,
    occ=[0.36, 0.46, 0.54, 0.58], gop=[0.23, 0.32, 0.37, 0.40], rooms_share=0.74,
    fixed_pct=0.03, exit_cap=0.09, capex_phasing=[0.10, 0.45, 0.45],
    gfa=9_800,
    capex=[("land", LAND_VALUE), ("construction", 9_800 * 14_000 / 1e6), ("infra", 21.0),
           ("medical", 26.0), ("ffe", 20.0), ("soft", 17.0), ("preopen", 13.0), ("contingency", 17.0)],
    resi=dict(n=12, price=4.4, unit_cost=2.1, area=200, sales_ph=RESI_SALES_PH, cost_ph=RESI_COST_PH),
)

# ---------------------------------------------------------------- promotion (B)
B = dict(
    code="B",
    units=[  # (clé, nombre, surface m², prix MAD/m², coût construction MAD/m²)
        ("signature", 8, 450, 21_000, 8_200),
        ("forest", 28, 290, 17_500, 7_200),
        ("lodge", 32, 130, 15_500, 6_400),
    ],
    club_gfa=1_400, club_cost_m2=11_000,
)


def promo_model(p, price_mult=1.0, capex_mult=1.0, pace=1.0):
    sales = sum(n * s * pr for _, n, s, pr, _ in p["units"]) / 1e6 * price_mult
    built = sum(n * s for _, n, s, _, _ in p["units"])
    construction = sum(n * s * c for _, n, s, _, c in p["units"]) / 1e6 * capex_mult
    club = p["club_gfa"] * p["club_cost_m2"] / 1e6 * capex_mult
    infra = 21.0 * capex_mult
    soft = 0.08 * (construction + club + infra)
    marketing = 0.06 * sales
    contingency = 0.06 * (construction + club + infra)
    finance = 9.0
    capex = [("land", LAND_VALUE), ("construction", construction), ("club", club), ("infra", infra),
             ("soft", soft), ("marketing", marketing), ("contingency", contingency), ("finance", finance)]
    total_cost = sum(v for _, v in capex)
    years = [2027, 2028, 2029, 2030, 2031, 2032]
    cost_ph = {"land": [1, 0, 0, 0, 0, 0], "soft": [0.4, 0.3, 0.2, 0.1, 0, 0],
               "marketing": [0.1, 0.3, 0.3, 0.2, 0.1, 0], "finance": [0, 0.25, 0.35, 0.3, 0.1, 0]}
    build_ph = [0, 0.30, 0.40, 0.30, 0, 0]
    sales_ph = [0, 0.12, 0.26, 0.32, 0.20, 0.10]
    if pace != 1.0:  # commercialisation plus lente : décalage d'une année d'une partie des ventes
        sales_ph = [0, 0.08, 0.18, 0.26, 0.24, 0.24]
    flows = []
    rows = []
    for i, y in enumerate(years):
        out = 0
        for k, v in capex:
            ph = cost_ph.get(k, build_ph)
            out += v * ph[i]
        inc = sales * sales_ph[i]
        recurring = 0.0
        if y >= 2031:
            recurring = 3.2 if y == 2031 else 4.6   # marge nette club + gestion locative
        rows.append(dict(year=y, cash_in=inc + recurring, cash_out=out, net=inc + recurring - out))
        flows.append(inc + recurring - out)
    cum, peak = 0, 0
    for f in flows:
        cum += f
        peak = min(peak, cum)
    pb_year, pb_dur = payback(flows, years)
    margin = sales - total_cost
    return dict(sales=sales, built=built, capex=capex, total_cost=total_cost, margin=margin,
                margin_on_sales=margin / sales, margin_on_cost=margin / total_cost, rows=rows,
                flows=flows, years=years, irr=irr(flows), npv=npv(DISCOUNT, flows),
                peak_funding=-peak, payback_year=pb_year, payback_dur=pb_dur)


def sensitivities_hotel(p):
    base = hotel_model(p)
    out = {"base": base["irr"]}
    out["adr_m10"] = hotel_model(p, adr_mult=0.9)["irr"]
    out["adr_p10"] = hotel_model(p, adr_mult=1.1)["irr"]
    out["occ_m5"] = hotel_model(p, occ_delta=-0.05)["irr"]
    out["occ_p5"] = hotel_model(p, occ_delta=0.05)["irr"]
    out["capex_p10"] = hotel_model(p, capex_mult=1.1)["irr"]
    out["capex_m10"] = hotel_model(p, capex_mult=0.9)["irr"]
    # prime à l'investissement : 15 % des coûts hors terrain (hypothèse prudente, plafond légal 30 %)
    m = hotel_model(p)
    flows = m["flows_exit"][:]
    flows[2] += 0.15 * m["capex_ex_land"]
    out["subsidy15"] = irr(flows)
    return out


def sensitivities_promo(p):
    return {
        "base": promo_model(p)["irr"],
        "price_m10": promo_model(p, price_mult=0.9)["irr"],
        "price_p10": promo_model(p, price_mult=1.1)["irr"],
        "capex_p10": promo_model(p, capex_mult=1.1)["irr"],
        "capex_m10": promo_model(p, capex_mult=0.9)["irr"],
        "slow": promo_model(p, pace=0.5)["irr"],
        "price_m10_margin": promo_model(p, price_mult=0.9)["margin_on_sales"],
        "capex_p10_margin": promo_model(p, capex_mult=1.1)["margin_on_sales"],
    }


def levered_irr_hotel(p, debt_share=0.45, rate=0.065, tenor=12):
    """TRI fonds propres indicatif : dette = 45 % du coût hors terrain, tirée au prorata des travaux."""
    m = hotel_model(p)
    debt = debt_share * m["capex_ex_land"]
    ann = debt * rate / (1 - (1 + rate) ** -tenor)
    flows = m["flows_exit"][:]
    nb = len(p["capex_phasing"])
    for i, ph in enumerate(p["capex_phasing"]):
        flows[i] += debt * ph
    bal = debt
    for k in range(10):
        idx = nb + k
        interest = bal * rate
        princ = ann - interest
        bal -= princ
        flows[idx] -= ann
    flows[-1] -= bal
    return irr(flows), debt


if __name__ == "__main__":
    for p in (A, C):
        m = hotel_model(p)
        print(p["code"], "resi margin", round(m["resi_margin"],1), "net need", round(m["net_equity_need"],1), "capex", round(m["capex_total"], 1), "exland", round(m["capex_ex_land"], 1),
              "per key", round(m["per_key"], 2), "IRR", round(m["irr"] * 100, 1),
              "NPV", round(m["npv"], 1), "payback", m["payback_year"], "yoc", round(m["yield_on_cost"] * 100, 1),
              "exit", round(m["exit_value"], 1))
        for r in m["rows"]:
            print("  ", r["year"], f"occ {r['occ']:.2f} adr {r['adr']:.0f} rev {r['total_rev']:.1f} ebitda {r['ebitda']:.1f} ({r['ebitda']/r['total_rev']*100:.0f}%)")
        print("  sens", {k: round(v * 100, 1) for k, v in sensitivities_hotel(p).items()})
        print("  levered", levered_irr_hotel(p))
    m = promo_model(B)
    print("B sales", round(m["sales"], 1), "cost", round(m["total_cost"], 1), "margin", round(m["margin"], 1),
          f"{m['margin_on_sales']*100:.1f}% / {m['margin_on_cost']*100:.1f}%", "IRR", round(m["irr"] * 100, 1),
          "peak", round(m["peak_funding"], 1), "payback", m["payback_year"], "built", m["built"])
    for k, v in m["capex"]:
        print("  ", k, round(v, 1))
    for r in m["rows"]:
        print("  ", r)
    print("  sens", {k: round(v * 100, 1) for k, v in sensitivities_promo(B).items()})
