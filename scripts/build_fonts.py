"""Generate locally hosted fonts; source font files stay outside the repository."""
from pathlib import Path
import argparse
import shutil
from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument("--chinese", required=True)
parser.add_argument("--latin", required=True)
parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
args = parser.parse_args()
root = Path(args.root)
out = root / "public" / "fonts"
out.mkdir(parents=True, exist_ok=True)

text_files = [root / "index.html", root / "public/c/index.html"]
text_files += [p for p in (root / "src").rglob("*") if p.suffix in {".vue", ".js", ".md"}]
text = "".join(p.read_text(encoding="utf-8") for p in text_files)
source = TTFont(args.chinese)
coverage = {cp for cp in source.getBestCmap() if cp > 0x024F}
common = coverage & {ord(char) for char in text}


def unicode_ranges(codepoints):
    ranges = []
    start = end = None
    for cp in sorted(codepoints):
        if end is not None and cp == end + 1:
            end = cp
            continue
        if start is not None:
            ranges.append(f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}")
        start = end = cp
    if start is not None:
        ranges.append(f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}")
    return ",".join(ranges)


css = []
for name, codepoints in [("hy-youyuan-common", common), ("hy-youyuan-extended", coverage - common)]:
    font = TTFont(args.chinese)
    options = subset.Options()
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out / f"{name}.woff2")
    css.append(f'''@font-face {{
  font-family: "HY YouYuan";
  src: url("/fonts/{name}.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: {unicode_ranges(codepoints)};
}}''')
    print(f"{name}: {len(codepoints)} glyphs, {(out / (name + '.woff2')).stat().st_size:,} bytes")

shutil.copyfile(args.latin, out / "CascadiaCode.woff2")
css.append('''@font-face {
  font-family: "Cascadia Code";
  src: url("/fonts/CascadiaCode.woff2") format("woff2");
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-024F;
}''')
(out / "fonts.css").write_text("\n\n".join(css) + "\n", encoding="utf-8")
latin = TTFont(args.latin)
notice = "Cascadia Code\n\n" + "\n\n".join(filter(None, [latin["name"].getDebugName(i) for i in [0, 13, 14]]))
notice += "\n\nHYYouYuan 55W\n\n" + "\n\n".join(filter(None, [source["name"].getDebugName(i) for i in [0, 13, 14]]))
notice += "\n\nThe HY font is user-supplied. Confirm a valid web embedding license before publishing.\n"
(out / "NOTICE.txt").write_text(notice, encoding="utf-8")
