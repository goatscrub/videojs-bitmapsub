#!/usr/bin/env python3
# -*- coding: UTF8 -*-

import sys, os, itertools, argparse, datetime, math, tempfile
from PIL import Image, ImageDraw
from collections import namedtuple

cliParser=argparse.ArgumentParser(
    prog=os.path.basename(sys.argv[0]),
    description='',
    epilog='Have bien le fun.'
)
cliParser.add_argument('filename')
# cliParser.add_argument('-c', '--columns', action='store', default=4, type=int, help='number of columns within image pack, default: 4')
cliParser.add_argument('-d', '--debug', action='store_true', default='store_false', help='temporary files are not remove')
# cliParser.add_argument('-r', '--rows', action='store', default=64, type=int, help='number of rows within image pack, default: 64')
cliParser.add_argument('-l', '--limit', action='store', default=999999, type=int, help='limit number of subtitle to be processed, for tests purposes')
cliParser.add_argument('-t', '--targetDirectory', action='store', default=os.getcwd(), type=str, help='folder destination for files generated')
cliArgs=cliParser.parse_args()

enable_debug=cliArgs.debug
if (os.path.isfile(cliArgs.filename)):
    filename=cliArgs.filename
    basename=os.path.basename(filename)
    vobfile=open(filename, 'rb')
    # define image prefix
    image_prefix=os.path.splitext(basename)[0]+'-'
    image_extension='png'
    # define webvtt filename
    webvtt_filename=os.path.splitext(basename)[0]+'.vtt'
    pack_prefix=os.path.splitext(basename)[0]+'-'
    pack_extension='png'
else:
    print(f'File \'{cliArgs.filename}\' does not exist, abort.')
    sys.exit(1)
if not os.path.isdir(cliArgs.targetDirectory):
    print('Destination folder does not exist, abort.')
    sys.exit(1)
# rows, columns = cliArgs.rows, cliArgs.columns
test_nofbytes = 256

# Check vobfile header, search Pack Header 0x000001ba (4 bytes)
header=vobfile.read(4)
if ( header != b'\x00\x00\x01\xba' ):
    print(header)
    print('Wrong header file, this file does not seems to be a VOB file, abort.')
    sys.exit(1)
# else:
#     # try to determine total number of subtitles
#     # seek to last byte available
#     vobfile.seek(-test_nofbytes, 2)
#     # save lasts bytes
#     bytes = vobfile.read(test_nofbytes)
#     vobfile_info = search_nof_subs(bytes)
#     if vobfile_info:
#         vobfileInfo = namedtuple('vobfileInformation', 'v_width v_height nof_subs')
#         vobfile_info = vobfileInfo(*[ int(e) for e in vobfile_info.split() ])
#     vobfile.seek(0)
#     # TODO: what to do when no info ?
vobfile.seek(0)

def getStreamId(byte):
    if byte == b'\xb9': return 'Program end'
    if byte == b'\xba': return 'Pack header'
    if byte == b'\xbb': return 'System header'
    if byte == b'\xbc': return 'Program stream map'
    if byte == b'\xbd': return 'Private stream 1'
    if byte == b'\xbe': return 'Padding stream'
    if byte == b'\xbf': return 'Private stream 2'
    if int.from_bytes(byte) in range(0xc0, 0xdf): return 'MPEG-1 or MPEG-2 audio stream'
    if int.from_bytes(byte) in range(0xe0,0xef): return 'MPEG-1 or MPEG-2 video stream'
    if byte == b'\xf0': return 'ECM stream'
    if byte == b'\xf1': return 'EMM stream'
    if byte == b'\xf2': return 'ITU-T Rec. H.222.0 | ISO/IEC 13818-1 Annex A or ISO/IEC 13818-6_DSMCC_stream'
    if byte == b'\xf3': return 'ISO/IEC_13522_stream'
    if byte == b'\xf4': return 'ITU-T Rec. H.222.1 type A'
    if byte == b'\xf5': return 'ITU-T Rec. H.222.1 type B'
    if byte == b'\xf6': return 'ITU-T Rec. H.222.1 type C'
    if byte == b'\xf7': return 'ITU-T Rec. H.222.1 type D'
    if byte == b'\xf8': return 'ITU-T Rec. H.222.1 type E'
    if byte == b'\xf9': return 'ancillary_stream'
    if int.from_bytes(byte) in range(0xfa, 0xfe): return 'reserved'
    if byte == b'\xff': return 'Program stream directory'
    return False

# 0xb9 - 0xff (255+1 because of range)
streamId=[ bytes.fromhex(f'{n:x}') for n in range(185, 256) ]
packHeader=[[b'\x00'], [b'\x00'], [b'\x01'], streamId]
search_index=0
found=b''
while cliArgs.limit > 0:
    bytes=vobfile.read(1)
    n, nofbytes=0, len(bytes)

    while n < nofbytes:
        n += 1
        byte = bytes[nofbytes-n:nofbytes-n+1]
        if ( byte in packHeader[search_index] ):
            search_index+=1
            found+=byte
            if search_index >= len(packHeader):
                search_index=0
                print(f'found {found}: {getStreamId(byte)}')
                if byte == b'\xbd':
                    print(int.from_bytes(vobfile.read(2)))
                    e=bin(int.from_bytes(vobfile.read(2)))
                    print('10:{} scrmbl:{} priority:{} align:{} copyr:{} org:{}'.format(e[2:4], e[4:6], e[6:7], e[7:8], e[8:9], e[9:10]))
                    print('P|DTS flag:{} escr:{} esrate:{} dsm:{} copyInfo:{} crc:{} extflg:{}'.format(e[10:12], e[12:13], e[13:14], e[14:15], e[15:16], e[16:17], e[17:18]))
                    pes_data_len=int.from_bytes(vobfile.read(1))
                    print(bin(pes_data_len), pes_data_len)
            else:
                continue
        else:
            search_index=0
            found=b''
            # print(f'false: {byte} against: {packHeader[search_index]}')

            # # found b'G' or 0x47 byte, so now check
            # # if previous byte is 0x50 or b'P'
            # n += 1
            # byte = bytes[nofbytes-n:nofbytes-n+1]
            # if ( byte == b'P' ):
            #     # PGS header found, now check if sub segment type is PCS
            #     pgs_offset = 13
            #     pgs = bytes[nofbytes-n:nofbytes-n+pgs_offset]
            #     if ( pgs[10:11] == b'\x16' ):
            #         pcs_size = int.from_bytes(pgs[11:13])
            #         pcs_bytes = bytes[nofbytes-n+pgs_offset:nofbytes-n+pgs_offset+pcs_size]
            #         # PCS pts value is not important here (set to 0)
            #         pcs = readPCS(pcs_bytes, 0)
            #         return f'{pcs.video_width} {pcs.video_height} {(pcs.comp_n//2)+1:d}'
    cliArgs.limit -=1

    # header=vobfile.read(10)
    # systemClock1=header[2:5]
    # systemClock2=header[6:21]
    # systemClock3=header[22:37]
    # srcExtension=header[38:47]
    # bitRate=header[48:70]
    # stuffingLength=header[77:80]
    # print(systemClock1, systemClock2, systemClock3, srcExtension, bitRate, stuffingLength)
    # cliArgs.limit -=1
