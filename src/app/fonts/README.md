Montserrat and Source Sans 3 from github.com/google/fonts (SIL OFL 1.1, licences beside the files).
Variable fonts instanced to the used weights and subset to Latin (#129): Basic Latin, Latin-1 Supplement, Latin
Extended-A (Turkish ğ İ ı ş, German ä ö ü ß, most European Latin scripts), ẞ, dashes, quotes (incl. „ ‚), bullet,
ellipsis, € ₺ ™, arrows and minus. Montserrat is used only at 600 (headings, nav, buttons), so it ships as a static 600
instance; Source Sans 3 keeps the 400–600 axis (body and semibold). Nothing on the site asks for 700: strong/b/th are
set to 600 in styles.css and weight synthesis is off, so there is no faux bold. Default layout features (ccmp, locl, …) are kept, plus kern/liga/calt/lnum/tnum. 75 KB → 43 KB for both
(Montserrat 18.5 KB, Source Sans 3 24.7 KB).

    fonttools varLib.instancer 'Montserrat[wght].ttf' wght=600 -o M.ttf
    fonttools varLib.instancer 'SourceSans3[wght].ttf' wght=400:600 -o S.ttf
    U="U+0020-007E,U+00A0-017F,U+1E9E,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212"
    pyftsubset M.ttf --unicodes="$U" --flavor=woff2 --layout-features+=kern,liga,calt,lnum,tnum --output-file=Montserrat.woff2
    pyftsubset S.ttf --unicodes="$U" --flavor=woff2 --layout-features+=kern,liga,calt,lnum,tnum --output-file=SourceSans3.woff2

Other scripts (Cyrillic, Arabic) live in their own files with a matching `unicode-range`, so Latin pages never
download them. Characters outside every subset fall back to the system font.

Cyrillic files (`*-cyrillic.woff2`, for ru) come from the same instances (Montserrat static 600, Source Sans 3
400–600), subset to Russian Cyrillic and №, declared with this unicode-range:

    pyftsubset M.ttf --unicodes="U+0400-045F,U+0490-0491,U+2116" --flavor=woff2 \
      --layout-features+=kern,liga,calt,lnum,tnum --output-file=Montserrat-cyrillic.woff2

`NotoSansArabic.woff2` (ar, SIL OFL 1.1, licence beside it) from github.com/google/fonts `ofl/notosansarabic`: instanced to
wght 400–700 at normal width and subset to Arabic, Arabic Supplement, the presentation forms and the joiner/bidi controls, with
the shaping features (~68 KB). It stands in for both
Montserrat and Source Sans 3, which have no Arabic glyphs, and loads only on pages with Arabic text (unicode-range):

    fonttools varLib.instancer "NotoSansArabic[wdth,wght].ttf" wght=400:700 wdth=100 -o A.ttf
    pyftsubset A.ttf --unicodes="U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F,U+2066-2069" --flavor=woff2 \
      --layout-features='ccmp,isol,init,medi,fina,rlig,liga,calt,mark,mkmk,kern,curs' --output-file=NotoSansArabic.woff2
