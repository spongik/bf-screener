@@ echo Languages: ru, en, fr, uk, kk, cs, zh
@@ echo Currencies: RUB, USD, EUR, AMD, AZN, BYR, CNY, GBP, KGS, KZT, TJS, 
@@ echo             UAH, CHF, TND, GEL
@@ echo Tags: xs, sm, md, lg, auto, manual, search, rooms, preview, complete, 
@@ echo       payment, azimut, availability, details, order, promo, transfers, 
@@ echo       constructor, calendar, terms, instruction, office, rule, select, 
@@ echo       cancellation, list, option
@@ echo.

@@ set LNG=
@@ set CUR=
@@ set TAG=

@@ set /p LNG="Enter language: "
@@ set /p CUR="Enter currency: "
@@ set /p TAG="Enter tag: "
@@ echo.

@@ phantomjs bfscreener.js --lng=%LNG% --cur=%CUR% --tag=%TAG%
@@ pause