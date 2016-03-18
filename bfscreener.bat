@@ echo Languages: ru, en-US, en-GB, fr, it, de, uk, kk, cs, zh
@@ echo Currencies: RUB, USD, EUR, AMD, AZN, BYR, CNY, GBP, KGS, KZT, TJS, 
@@ echo             UAH, CHF, TND, GEL, IDR
@@ echo Tags: xs, sm, md, lg, auto, manual, search, rooms, preview, complete, 
@@ echo       payment, azimut, availability, details, order, promo, transfers, 
@@ echo       constructor, calendar, terms, instruction, office, rule, select, 
@@ echo       cancellation, list, option, guest, price-list, large-rooms
@@ echo.

@@ set LNG=
@@ set CUR=
@@ set THEME=
@@ set TAG=

@@ set /p LNG="Enter language: "
@@ set /p CUR="Enter currency: "
@@ set /p THEME="Enter theme: "
@@ set /p TAG="Enter tag: "
@@ echo.

@@ "bin/phantomjs" bin/bfscreener.js --lng=%LNG% --cur=%CUR% --theme="%THEME%" --tag=%TAG%
@@ pause