#!/bin/sh
# Baut die App und veröffentlicht sie auf GitHub Pages (Branch gh-pages).
set -e
npm run build
rm -rf /tmp/ghp && cp -r dist /tmp/ghp && touch /tmp/ghp/.nojekyll
cd /tmp/ghp && git init -q -b gh-pages && git add -A && git -c user.email="zakariaghulami238@gmail.com" -c user.name="zaki-hanma" commit -qm "Veröffentlichung" && git push -qf https://github.com/zaki-hanma/Pazulic gh-pages
