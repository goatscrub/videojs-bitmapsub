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
# file rewind
vobfile.seek(0)

class Bits:
    def __init__(self, octets):
        self.load(octets)

    def load(self, octets):
        self.seek=0
        binary_seq_len_format='{{0:0{}b}}'.format(len(octets)*8)
        self.binary_sequence=binary_seq_len_format.format(int.from_bytes(octets))
        # print('leno:{} octets:{}'.format(len(octets), octets))
        # print(int.from_bytes(octets))

    def get(self, nofbits=1):
        if self.seek > len(self.binary_sequence):
            # print(self.seek)
            # print('lenbinseq:{} binseq:{}'.format(len(self.binary_sequence), self.binary_sequence))
            # print(len(self.binary_sequence))
            raise Exception('''Out of bound.''')
        bits=self.binary_sequence[self.seek:self.seek+nofbits]
        self.seek+=nofbits
        return int(bits, 2)

    def harvest(self, sequence):
        return [ self.get(nofbits) for nofbits in sequence ]

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

def printBinary(octets, packof=32):
    '''
    Print bytes input as binary representation.
    Binary representation is separated by space each 4 bits
    and a line break is appended after {packof} bits.

    :param octets: binary string
    :type bytes: byte
    :param packof: line break after {packof} bits, defaults to 32
    :type packof: int, optional
    '''
    n=0
    while n<=len(octets):
        try:
            print(octets[n:n+4], end=' ')
            n+=4
            if not n%64:
                print()
        except IndexError:
            print(octets[n:])

def readPesPacket(octets):
    '''
    Read MPEG-2 PES packet

    :param octets: PES packet bytes
    :type octets: bytes
    :return: Elementary stream
    :rtype: bytes
    '''
    PesPayloadLen=int.from_bytes(octets[4:6])
    # Extension
    bits=Bits(octets[6:8])
    # print(
    #     '>> {:02b} scrmbl:{:02b} priority:{:b} align:{:b} copyr:{:b} org:{:b}'
    #     .format(*bits.harvest([2,2,1,1,1,1]))
    # )
    PtsDtsFlag, escr, esRate, dsm, copy, crc, extFlag=bits.harvest([2,1,1,1,1,1,1])
    # print(
    #     '>> P|DTS flag:{:02b} escr:{:b} esrate:{:b} dsm:{:b} copyInfo:{:b} crc:{:b} extflg:{:b}'
    #     .format(PtsDtsFlag, escr, esRate, dsm, copy, crc, extFlag)
    # )
    PesHeaderDataLen=int.from_bytes(octets[8:9])
    # set offset because PES packet header has variable header length
    headerOffset=9
    # test if extra PES header present
    if (PtsDtsFlag == 0b10):
        bits.load(octets[9:14])
        # print(bits.harvest([4, 3, 1, 15, 1, 15, 1]))
        headerOffset=14
    # print(f'PES header data length: {PesHeaderDataLen}')
    # print(f'PES payload length: {PesPayloadLen}')
    return octets[headerOffset:]

def readSubtitleControlSequence(octets):
    ''''''
    print(octets)
    offset=0
    while offset < len(octets):
        ctrlSeq=octets[offset:offset+1]
        print(f'>>> {ctrlSeq}')
        if ctrlSeq == b'\x03':
            # need 3 bytes more
            colors=Bits(octets[offset+2:offset+5])
            print('color1:{} color2:{} color3:{} color4:{}'.format(*colors.harvest([4, 4, 4, 4])))
            offset+=3
            continue
        if ctrlSeq == b'\x04':
            # need 3 bytes more
            alphas=Bits(octets[offset+2:offset+5])
            print('alpha1:{} alpha2:{} alpha3:{} alpha4:{}'.format(*list(reversed(alphas.harvest([4, 4, 4, 4])))))
            offset+=3
            continue
        if ctrlSeq == b'\x05':
            # need 7 bytes more
            coordinates=Bits(octets[offset+2:offset+9])
            print('xbegin:{} xend:{} ybegin:{} yend:{}'.format(*coordinates.harvest([6,6,6,6])))
            offset+=7
            continue
        if ctrlSeq == b'\x06':
            # need 5 bytes more
            # if octets[-1:] != b'\xff': raise Exception('ctrlSeq termination error')
            lines=octets[offset+2:]
            print('first line:{} second line:{}'.format(int.from_bytes(lines[0:2]), int.from_bytes(lines[2:4])))
            offset+=7
            continue

        offset+=1

def readESSubtitle(octets):
    '''
    _summary_
    1 byte - substream id
    2 byte - subtitle packet size
    2 byte - data packet size

    :param octets: _description_
    :type octets: _type_
    '''
    substreamid=int.from_bytes(octets[0:1])
    octets=octets[1:]
    print(f'Substream id: {substreamid}')
    print('Subtitle Packet size: {}'.format(int.from_bytes(octets[0:2])))
    dataPacketSize=int.from_bytes(octets[2:4])
    print('Data packet size: {}'.format(dataPacketSize))

    endSequenceOffset=int.from_bytes(octets[dataPacketSize+2:dataPacketSize+4])
    print('End sequence position: {}'.format(endSequenceOffset))
    endSequence=octets[endSequenceOffset:]
    print(f'End control sequence: {endSequence}')

    controlSequence=octets[dataPacketSize+4:endSequenceOffset]
    readSubtitleControlSequence(controlSequence)
    print()

def readPackHeader(octets):
    '''
    Read Pack Header from MPEG-2 Program Stream
    3 bytes fixed + 1 byte pack identifier
    14 bytes
    3 bytes + 1 bytes
    program mux rate + reserved + pack stuffing length
    '''
    identifier=octets[0:4]
    if identifier != b'\x00\x00\x01\xba':
        raise Exception ('pouloum, paf.')
    bits=Bits(octets[4:10])
    fix, scr3230, w1, scr2915, w2, scr1400, w3, scrext, w4 = bits.harvest([2, 3, 1, 15, 1, 15, 1, 9, 1])
    # print('fix:{:02b} scr3230:{:03b} w1:{:b} scr2915:{:015b} w2:{:b} scr1400:{:015b} w3:{:b} scrext:{:09b} w4:{:b}'.format(fix, scr3230, w1, scr2915, w2, scr1400, w3, scrext, w4))
    bits.load(octets[10:14])
    prg_mux_rate, w5, w6, reserved, stuffing_len = bits.harvest([22, 1, 1, 5, 3])
    # print('prg_mux_rate:{:022b} w5:{:b} w6:{:b} reserved:{:05b} stuffing_len:{:03b}'.format(prg_mux_rate, w5, w6, reserved, stuffing_len))
    if False in [w1, w2, w3, w4, w5, w6]: raise Exception('Failure on marker bits witness.')
    if stuffing_len: raise Exception('Stuffing not handle, abort.')
    return True

def test_bit(value, offset):
    '''
    Return True if offset bit is 1 on value

    :param value: value
    :type value: int
    :param offset: bit offset
    :type offset: int
    :return: true or false
    :rtype: boolean
    '''
    mask=1<<offset
    if (value & mask): return True
    return False

# 0xb9 - 0xff (255+1 because of range)
streamId=[ bytes.fromhex(f'{n:x}') for n in range(185, 256) ]
packHeader=[[b'\x00'], [b'\x00'], [b'\x01'], streamId]
search_index=0
found=b''

while cliArgs.limit > 0:
    streamId=vobfile.read(4)
    if streamId == b'\x00\x00\x01\xba':
        readPackHeader(streamId+vobfile.read(10))
    elif streamId == b'\x00\x00\x01\xbd':
        PesPacketLength=vobfile.read(2)
        subtitle=readPesPacket(streamId+PesPacketLength+vobfile.read(int.from_bytes(PesPacketLength)))
        if subtitle:
            readESSubtitle(subtitle)
    cliArgs.limit-=vobfile.tell()

    # while True:
    #     # octet=vobfile.read(1)
    #     # chunk = octet[nofbytes+n:nofbytes+n+1]
    #     # n += 1
    #     if ( byte in packHeader[search_index] ):
    #         search_index+=1
    #         found+=byte
    #         if search_index >= len(packHeader):
    #             search_index=0
    #             # print(f'found {found}: {getStreamId(byte)}')
    #             print(f'> {getStreamId(byte)}')
    #             # stream ID: private stream
    #             if byte == b'\xbd':
    #                 PesPayloadLen=int.from_bytes(vobfile.read(2))

    #                 # Extension
    #                 bits=Bits(vobfile.read(2))
    #                 print(
    #                     '>> {} scrmbl:{} priority:{} align:{} copyr:{} org:{}'
    #                     .format(*bits.harvest([2,2,1,1,1,1]))
    #                 )
    #                 PtsDtsFlag, escr, esRate, dsm, copy, crc, extFlag=bits.harvest([2,1,1,1,1,1,1])
    #                 print(
    #                     '>> P|DTS flag:{} escr:{} esrate:{} dsm:{} copyInfo:{} crc:{} extflg:{}'
    #                     .format(PtsDtsFlag, escr, esRate, dsm, copy, crc, extFlag)
    #                 )
    #                 PesHeaderDataLen=int.from_bytes(vobfile.read(1))
    #                 # test if extra PES header present
    #                 if (PtsDtsFlag == '10'):
    #                     bits.load(vobfile.read(5))
    #                     print(bits.harvest([4, 3, 1, 15, 1, 15, 1]))
    #                 print(f'PES header data length: {PesHeaderDataLen}')
    #                 print(f'PES payload length: {PesPayloadLen}')

    #                 substreamid=int.from_bytes(vobfile.read(1))
    #                 print(f'substream id: {substreamid}')
    #                 PesPayload=vobfile.read(PesPayloadLen-1)
    #                 print('subtitle packet size: {}'.format(int.from_bytes(PesPayload[:2])))
    #                 dataPacketSize=int.from_bytes(PesPayload[2:4])
    #                 print('data packet size: {}'.format(dataPacketSize))
    #                 print('end sequence position: {}'.format(int.from_bytes(PesPayload[dataPacketSize+2:dataPacketSize+4])))
    #                 n=0
    #                 while n <= 32:
    #                     offset=dataPacketSize+4+n
    #                     print('ctrl sequence: {} {}'.format(dataPacketSize+n, PesPayload[offset:offset+1]))
    #                     n+=1

    #                 # print('ff byte ?: {}'.format(int.from_bytes(PesPayload[dataPacketSize+2:dataPacketSize+4])))
    #                 # print('ctrl sequence: {}'.format(PesPayload[dataPacketSize+7:dataPacketSize+8]))
    #                 print()
    #         else:
    #             continue
    #     else:
    #         search_index=0
    #         found=b''
    # cliArgs.limit -=1
