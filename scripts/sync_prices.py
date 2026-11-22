#!/usr/bin/env python3
"""Fresha -> website price sync for xquizitesalon.com.

Reads the public XQUIZITE page on Fresha (the structured service list Fresha
publishes for Google), compares every price with the price list in index.html
(each row carries its Fresha service ID in data-fid), and updates the numbers.

Safety rules (nothing on the site changes when any of these trigger):
  * fewer than MIN_SERVICES services read from Fresha  -> stop
  * any price of 0 or below                              -> stop
  * more than MAX_CHANGES prices changing at once         -> stop
It never adds or removes services by itself: new, removed or unclear items are
reported for a person to handle. Promotion prices (Fresha shows a low and a high
price) never replace the usual price.

Writes a Markdown report and prints `status=<ok|changes|attention|stop>` and
`changes=<n>` lines for the GitHub workflow.
Only the Python standard library is used.
"""
import argparse
import html
import json
import os
import re
import sys
import urllib.request

FRESHA_URL = ("https://www.fresha.com/a/"
              "xquizite-salon-juffair-manama-shop-no-109-building-140-road-41-block-340-wh69oztf")
MIN_SERVICES = 55
MAX_CHANGES = 10
ROW_RE = re.compile(
    r'(<li data-fid="(\d+)"><span class="n">([^<]+)</span><span class="p">(<i>[^<]*</i>)?)([^<]+)(</span>)')


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; XQUIZITE-website-price-sync/1.0; +https://xquizitesalon.com)",
        "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def read_fresha(page):
    offers = {}
    for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        stack = [data]
        while stack:
            o = stack.pop()
            if isinstance(o, dict):
                if o.get("@type") in ("AggregateOffer", "Offer") and "itemOffered" in o and "offer-s:" in o.get("@id", ""):
                    fid = o["@id"].split("offer-s:")[-1]
                    name = html.unescape(o["itemOffered"].get("name", "")).split("| ")[-1].strip()
                    offers[fid] = {"name": name, "price": o.get("price"),
                                   "low": o.get("lowPrice"), "high": o.get("highPrice")}
                stack.extend(o.values())
            elif isinstance(o, list):
                stack.extend(o)
    return offers


def num(x):
    try:
        return None if x is None else float(x)
    except (TypeError, ValueError):
        return None


def fmt(x):
    return str(int(x)) if float(x).is_integer() else ("%.3f" % x).rstrip("0").rstrip(".")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default="index.html")
    ap.add_argument("--report", default="sync-report.md")
    ap.add_argument("--fresha-file", help="read a saved Fresha page instead of downloading (testing)")
    ap.add_argument("--dry-run", action="store_true", help="report only, never write index.html")
    a = ap.parse_args()

    notes, attention, changes = [], [], []
    status = "ok"
    try:
        page = open(a.fresha_file, encoding="utf-8").read() if a.fresha_file else fetch(FRESHA_URL)
        offers = read_fresha(page)
    except Exception as e:  # network or format problem
        offers, status = {}, "stop"
        notes.append(f"Could not read the Fresha page: {e}")

    # Test hook (manual runs only): TEST_OVERRIDE="26218100:4" pretends Fresha shows that price.
    for item in filter(None, os.environ.get("TEST_OVERRIDE", "").replace(" ", "").split(",")):
        fid, _, val = item.partition(":")
        if fid in offers:
            offers[fid].update(price=val, low=None, high=None)
            notes.append(f"TEST MODE: pretending Fresha shows {offers[fid]['name']} at BHD {val}.")

    site = open(a.html, encoding="utf-8").read()
    rows = ROW_RE.findall(site)

    if status != "stop" and len(offers) < MIN_SERVICES:
        status = "stop"
        notes.append(f"Only {len(offers)} services were read from Fresha (expected at least {MIN_SERVICES}). "
                     "Fresha may have changed its page. Nothing was changed.")

    new_site = site
    if status != "stop":
        on_site = set()
        for full_prefix, fid, name, prefix, price_txt, close in rows:
            on_site.add(fid)
            o = offers.get(fid)
            if not o:
                attention.append(f"**{name}** is on the website but no longer on Fresha (archived or hidden online). "
                                 "Remove it from the website or put it back on Fresha.")
                continue
            current = num(price_txt)
            p, lo, hi = num(o["price"]), num(o["low"]), num(o["high"])
            is_from = bool(prefix) and "from" in prefix
            if p is not None:
                target = p
                if is_from:
                    attention.append(f"**{name}**: Fresha now has one fixed price (BHD {fmt(p)}) but the website says "
                                     "'from'. Check the wording.")
            elif lo is not None and hi is not None:
                if is_from:
                    attention.append(f"**{name}**: Fresha shows BHD {fmt(lo)} to {fmt(hi)} (a promotion or price range). "
                                     "Not changed automatically. Check it.")
                    continue
                target = hi  # promotion running: keep the usual price
                notes.append(f"{name}: a promotion is running on Fresha (BHD {fmt(lo)} online). "
                             f"The website keeps the usual BHD {fmt(hi)}.")
            elif lo is not None:
                target = lo
                if not is_from:
                    attention.append(f"**{name}**: Fresha now prices this 'from' BHD {fmt(lo)} (by length or option). "
                                     "Check the website wording.")
            else:
                attention.append(f"**{name}**: Fresha shows no price. Not changed.")
                continue
            if target <= 0:
                status = "stop"
                notes.append(f"{name} shows BHD {fmt(target)} on Fresha. Prices of 0 are never published. Nothing was changed.")
                break
            if current is None or abs(current - target) > 1e-9:
                changes.append((fid, name, price_txt, fmt(target)))
        for fid, o in offers.items():
            if fid not in on_site:
                attention.append(f"**{o['name']}** is new on Fresha and not on the website yet. Add it to the right section.")

    if status != "stop" and len(changes) > MAX_CHANGES:
        status = "stop"
        notes.append(f"{len(changes)} prices changed at once (limit {MAX_CHANGES}). This looks unusual, so nothing was "
                     "changed automatically. Check Fresha, then ask for a manual update.")

    if status != "stop" and changes:
        def repl(m):
            for fid, _, _, new in changes:
                if m.group(2) == fid:
                    return m.group(1) + new + m.group(6)
            return m.group(0)
        new_site = ROW_RE.sub(repl, site)
        if not a.dry_run:
            open(a.html, "w", encoding="utf-8").write(new_site)
        status = "changes"
    elif status != "stop" and attention:
        status = "attention"

    lines = ["# Fresha → website price check", ""]
    lines.append(f"Fresha services read: **{len(offers)}** · website price rows: **{len(rows)}**")
    lines.append("")
    if changes:
        lines += ["## Price changes to approve", "", "| Service | Website now | Fresha | ", "|---|---|---|"]
        lines += [f"| {n} | BHD {old} | **BHD {new}** |" for _, n, old, new in changes]
        lines.append("")
    if attention:
        lines += ["## Needs a person", ""] + [f"- {x}" for x in attention] + [""]
    if notes:
        lines += ["## Notes", ""] + [f"- {x}" for x in notes] + [""]
    if status == "ok":
        lines.append("Everything matches. Nothing to do.")
    open(a.report, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"status={status}")
    print(f"changes={len(changes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
