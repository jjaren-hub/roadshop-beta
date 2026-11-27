"""Refresh only the public EIA weekly national diesel benchmark."""
import datetime as dt
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

URL = "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EMD_EPD2D_PTE_NUS_DPG"
OUT = Path("data/eia-diesel.json")
SERIES = "EMD_EPD2D_PTE_NUS_DPG"

class Table(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            if self.row is not None:
                self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

def parse(html, today):
    if "Weekly U.S. No 2 Diesel Retail Prices" not in html:
        raise ValueError("Unexpected EIA series page")
    table = Table()
    table.feed(html)
    values = {}
    for row in table.rows:
        if not row or not re.fullmatch(r"\d{4}-[A-Za-z]{3}", row[0]):
            continue
        year = int(row[0][:4])
        for day, value in zip(row[1::2], row[2::2]):
            if not re.fullmatch(r"\d{2}/\d{2}", day) or not re.fullmatch(r"\d{1,2}\.\d{3}", value):
                continue
            date = dt.date.fromisoformat(f"{year}-{day.replace('/', '-')}")
            price = float(value)
            if date <= today and 0 < price < 30:
                values[date] = price
    dates = sorted(values)
    if len(dates) < 2 or (today - dates[-1]).days > 14 or not 6 <= (dates[-1]-dates[-2]).days <= 8:
        raise ValueError("Missing or stale weekly observations")
    week, previous = dates[-1], dates[-2]
    return dict(series=SERIES, week=week.isoformat(), price=values[week],
                previousWeek=previous.isoformat(), previousPrice=values[previous])

def main():
    if "--test" in sys.argv:
        html = """Weekly U.S. No 2 Diesel Retail Prices<table><tr><td>2026-Nov</td><td>11/16</td><td>5.937</td><td>11/23</td><td>5.695</td><td>11/30</td><td>0.000</td></tr></table>"""
        assert parse(html, dt.date(2026, 11, 27))["price"] == 5.695
        try:
            parse(html, dt.date(2026, 12, 20))
        except ValueError:
            pass
        else:
            raise AssertionError("Stale series accepted")
        print("PASS EIA parser fixtures")
        return
    request = Request(URL, headers={"User-Agent": "EarnKeep weekly public data refresh"})
    with urlopen(request, timeout=45) as response:
        html = response.read(4_000_000).decode("utf-8", errors="replace")
    result = parse(html, dt.datetime.now(dt.timezone.utc).date())
    existing = json.loads(OUT.read_text()) if OUT.exists() else {}
    if result["week"] < existing.get("week", ""):
        raise ValueError("EIA observation older than published benchmark")
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Verified EIA week", result["week"])

if __name__ == "__main__":
    main()
