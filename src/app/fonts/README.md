Montserrat and Source Sans 3 from github.com/google/fonts (SIL OFL 1.1, licences beside the files).
Variable fonts instanced to the used weights and subset to Latin + Latin Extended (Turkish), ₺, € and punctuation:

    fonttools varLib.instancer Montserrat[wght].ttf wght=600:700 -o M.ttf
    pyftsubset M.ttf --unicodes="U+0000-00FF,U+0100-024F,U+0259,U+1E00-1EFF,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212" \
      --flavor=woff2 --layout-features='kern,liga,calt,lnum,tnum' --output-file=Montserrat.woff2
