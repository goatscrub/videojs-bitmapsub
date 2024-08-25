#!/bin/bash
# -*- coding: UTF8 -*-

if [[ -z "${1}" ]] 
then
    echo "file required, abort."
    exit 1
fi
filename="${1}"
colors=$(sed -n '/palette/{s/,//g;s/^palette://p}' "${filename}")
[[ -z "${colors}" ]] && echo "no palette found in file, abort." && exit 2
outfile="${filename}.htm"
echo '<!DOCTYPE html>
<html lang="fr-FR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>color palette - '${filename}'</title>
    <style>
        * {margin:0;padding:0;box-sizing:border-box;}
        main { width:432px;margin:10px;}
        span { display:inline-block;width:100px;height:50px;border:1px solid #e4e4e4;margin:0 5px 5px 0;}
    </style>
  </head>
  <body>
  <main>' > "${outfile}"
for color in ${colors}
do
    echo '<span style="background:#'${color}';"></span>'
done >> "${outfile}"
echo '</main>
</body>
</html>' >> "${outfile}"
