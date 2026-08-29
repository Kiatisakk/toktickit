"""Extract the labsheet's screen illustrations from the tracked PDF.

    python docs/lab-02/figures/extract.py        (needs: pip install pypdf)

The PNGs are written beside this script and are **not** committed. The labsheet
PDF is already tracked in `material/`, so committing the images would store the
same bytes twice; this script makes them reproducible instead.

§8.8 requires the built screens to be checked against these illustrations, which
is what makes them binding rather than decorative. figure-audit.md records the
result of that check in words, and is the part that is committed.
"""

import sys
from pathlib import Path

try:
    import pypdf
except ImportError:
    sys.exit("pypdf is not installed. Run: pip install pypdf")

ROOT = Path(__file__).resolve().parents[3]
PDF = ROOT / "material" / "UTF-8_Lab_02_labsheet-1.pdf"
OUT = Path(__file__).resolve().parent

# 1-based page numbers, as printed in the handout.
FIGURES = {
    2: "figure-1-ticket-detail.png",
    9: "figure-requester-selection.png",
    11: "figure-my-tickets.png",
}


def main() -> None:
    if not PDF.exists():
        sys.exit(f"Labsheet not found at {PDF}")

    reader = pypdf.PdfReader(str(PDF))

    for page_number, filename in FIGURES.items():
        images = list(reader.pages[page_number - 1].images)

        if not images:
            sys.exit(f"Page {page_number} carries no image. Has the PDF changed?")

        target = OUT / filename
        target.write_bytes(images[0].data)
        print(f"page {page_number:>2} -> {filename}  ({len(images[0].data):,} bytes)")


if __name__ == "__main__":
    main()
