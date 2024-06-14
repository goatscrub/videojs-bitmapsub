#!/bin/bash
# -*- coding: UTF8 -*-

max=1242
step=128
n=0
while :
do
    range_start="$(( (step*n) + 1 ))"
    range_end="$(( step*(n+1) ))"
    [[ ${range_end} -gt ${max} ]] && range_end="${max}"
    echo "${range_start}-${range_end}"
    convert \
        $(printf "thelma_fre2%04d.png\n" $(seq ${range_start} ${range_end})) \
        -append pass1_${n}.png
    [[ "${range_end}" == "${max}" ]] && break
    n=$((n+1))
done
