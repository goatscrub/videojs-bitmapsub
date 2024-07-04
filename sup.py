#!/usr/bin/env python3
# -*- coding: UTF8 -*-
import sys, os
from PIL import Image, ImageDraw, ImageShow
from collections import namedtuple

enable_debug=False
enable_colorize=False
try:
    if (sys.argv[1] == '-d'):
        enable_debug=True
    if (os.path.isfile(sys.argv[-1])):
        filename=sys.argv[-1]
    else:
        print('File does not exist, abort.')
        sys.exit(1)

except IndexError:
    pass

c_yellow='\033[0;33m'
c_white='\033[1;37m'
c_green='\033[0;32m'
c_cyan='\033[0;36m'
c_red='\033[0;31m'
c_blue='\033[0;34m'
c_term_reset='\033[0m'

supfile=open(filename, 'rb')
count=0
max_count=64

def debug_header():
    if (enable_debug):
        header='{:>3} {:>3} {:10} {:2s} {:3s} {:1s} {:5s} {:4s}'.format('ccc', 'aaa', 'bits', 'wt', 'rp', 'B', 'bytes', 'xpos')
        sep=len(header)*'-'
        return f'{header}\n{sep}'

def debug(locale_vars):
    if (enable_debug):
        print(format(f'{locale_vars['c_term_color']}{locale_vars['color'][0]:>3},{locale_vars['color'][1]:>3} {locale_vars['bits']:>10} {locale_vars['witness']:>2} {locale_vars['repeat']:<3} {locale_vars['octets']:>1} {str(locale_vars['byte'])[2:-1]:5s} {locale_vars['drawer'].x}{c_term_reset}'))


class ImageViewer(ImageShow.Viewer):
    def __init__(self, viewer_command):
        super().__init__()
        self.command=viewer_command

    def get_command(self, file, **kargs):
        return '{} {}'.format(self.command, file)

m=ImageViewer('/usr/bin/display')
m.get_command('prout')

ImageShow.register(m, 0)

class DataReader:
    def __init__(self, data):
        self.data=data
        self.pointer=0

    def consume(self, length):
        next=self.pointer+length
        try:
            chunk = self.data[self.pointer:next]
            self.pointer=next
            return chunk
        except IndexError:
            return False

class Drawer:
    def __init__(self, image):
        self.image=image
        self.x=0
        self.y=0

    def draw(self, color, length):
        # if ( color[0] != 0 or color[0] != 255 ):
        #     # print(color)
        #     self.x+=length
        #     return
        # if (color == (255, 255)):
            # color=(0, 0)

        if ( length > 1):
            # drawing line
            draw=ImageDraw.Draw(self.image)
            draw.line([(self.x, self.y), (self.x+length, self.y)], fill=(color), width=1, joint=None)
        else:
            # print("here")
            for n in range(length):
                self.image.putpixel((self.x+n, self.y), color)
        self.x+=length

    def nextLine(self):
        self.x=0
        self.y+=1

def colorize(color, alternative):
    if (enable_colorize): return alternative
    return color

def readObject(image, data):
    l,max_line,fwidth=1, 1, 25

    print('> read object data')
    print(data[:32], '\n')
    print(debug_header())
    data=DataReader(data)
    previousAlso=False
    drawer=Drawer(image)
    while True:
        byte=data.consume(1)
        if ( not byte ): break

        bits=format(int.from_bytes(byte), '#010b')
        witness=bits[2:4]
        repeat=int(bits[4:], 2)
        # define default color, completely transparent
        color=colorize((128, 128), (255, 0, 0, 0))
        octets=1
        c_term_color=''

        if ( previousAlso ):
            octets+=1
            if ( byte == b'\x00' ):
                # new line encountered
                drawer.nextLine()
                # print('{:->25}'.format(''))
                l+=1
                c_term_color=c_white
                color=('×××', '×××')
                witness='××'
                repeat='×××'
                # if ( l > max_line ): return False
                # if ( l > max_line ): break
            elif ( witness == '00' ):
                # two bytes, default color (transparent with shorter sequence)
                # 000000 00LLLLLL
                print('blue')
                c_term_color=c_blue
                color=colorize(color, (0, 0, 255, 255))
                drawer.draw(color, repeat)
            elif ( witness == '01'):
                print('red')
                c_term_color=c_red
                # three bytes, default color (transparent with longer sequence)
                # 00000000 00LLLLLL LLLLLLLL
                color=('×××', '×××')
                debug(locals())
                repeat_str=bits[4:]
                byte=data.consume()
                bits=format(int.from_bytes(byte), '#010b')
                octets+=1
                repeat_str+=bits[2:]
                repeat=int(f'0b{repeat_str}', 2)
                color=colorize(color, (255, 0, 0, 255))
                drawer.draw(color, repeat)
            elif ( witness == '10'):
                c_term_color=c_cyan
                # three bytes, with define color shorter sequence
                # 000000 00LLLLLL CCCCCCCC
                color=('×××', '×××')
                debug(locals())
                byte=data.consume(1)
                bits=format(int.from_bytes(byte), '#010b')
                octets+=1
                color=colorize((int.from_bytes(byte), 255), (0, 255, 255, 255))
                drawer.draw(color, repeat)
                # witness and repeat become N/A because of data.consume
                witness, repeat='xx', '×××'
            elif ( witness == '11'):
                # four bytes, with define color longer sequence
                # 00000000 00LLLLLL LLLLLL CCCCCCCC
                c_term_color=c_green
                color=('×××', '×××')
                debug(locals())
                repeat_str=bits[4:]
                byte=data.consume(1)
                bits=format(int.from_bytes(byte), '#010b')
                repeat_str+=bits[2:]
                repeat=int(f'0b{repeat_str}', 2)
                # print(repeat_str)
                octets+=1
                debug(locals())
                byte=data.consume(1)
                bits=format(int.from_bytes(byte), '#010b')
                octets+=1
                color=colorize((int.from_bytes(byte), 255), (0, 255, 0, 255))
                drawer.draw(color, repeat)
                # witness and repeat become N/A because of data.consume
                witness, repeat='xx', '×××'
            # reset marker
            previousAlso=False

        # marker encountered
        elif ( byte == b'\x00' ):
            c_term_color=c_yellow
            previousAlso=True
            color=('×××', '×××')
            repeat='×××'
            witness='××'

        else:
            # one byte, isolated colored pixel
            witness='××'
            repeat=1
            color=colorize((int.from_bytes(byte), 255), (255, 0, 255, 255))
            drawer.draw(color, repeat)

        debug(locals())
    print(l)

def readEnd(data):
    print('> end')
    data=DataReader(data)

def readODS(data, palette):
    global ods_count
    print('> object')
    data=DataReader(data)
    id=int.from_bytes(data.consume(2))
    version=int.from_bytes(data.consume(1))
    lastInSequenceFlag=data.consume(1)
    dataLength=int.from_bytes(data.consume(3))
    width=int.from_bytes(data.consume(2))
    height=int.from_bytes(data.consume(2))
    print('> id:{} version:{} lISF:{} dL:{} w:{} h:{}'.format(id, version, lastInSequenceFlag, dataLength, width, height))
    objectData=data.consume(dataLength)
    imageFilename='/tmp/image-{:04d}.png'.format(ods_count)
    if (enable_colorize):
        image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    else:
        # image = Image.new('LA', (width, height), (0, 0))
        image = Image.new('PA', (width, height), (0, 0))
        image.putpalette(palette)
    r=readObject(image, objectData)
    # image.save(imageFilename)
    image.convert('RGB')
    image.save('/tmp/coin.png')
    image.show()
    image.close()
    # os.system('/usr/bin/display {}'.format(imageFilename))
    if ( not r ): input()

ColorYUV=namedtuple('ColorYUV', 'y cr cb a')

def readPDS(data):
    print('> palette')
    palette=[ColorYUV(0, 0, 0, 0)]*256
    data=DataReader(data)
    id=int.from_bytes(data.consume(1))
    version=int.from_bytes(data.consume(1))
    # c=0
    while True:
        entryID=int.from_bytes(data.consume(1))
        if ( not entryID ): break
        # palette=Palette(*data.consume(4))
        palette[entryID]=ColorYUV(*data.consume(4))
        # luminance=int.from_bytes(data.consume(1))
        # colorDifferenceRed=int.from_bytes(data.consume(1))
        # colorDifferenceBlue=int.from_bytes(data.consume(1))
        # alpha=int.from_bytes(data.consume(1))
        # c+=1
        # print('pID:{} pVN:{} pEID:{} l:{} cDR:{} cDB:{} a:{} '.format(id, paletteVersionNumber, paletteEntryID, luminance, colorDifferenceRed, colorDifferenceBlue, alpha))
    print('number of palette: {}'.format(len(palette)))
    # hexPalette(palette)
    return palette

def hexPalette(palette):
    f=open('/tmp/palette.htm', 'w')
    f.write('<html><head><link rel="stylesheet" href="file:///home/gnuk/workflow/videojs-vobsub/palette.css"></head><body>')
    for c in palette:
        r,v,b= (int(c[3]+1.402*(c[4]-128)), int(c[3]-0.34414*(c[5]-128)-0.71414*(c[4]-128)), int(c[3]+1.772*(c[5]-128)))
        d='<span style="background:#{0}{1}{2}{3:>02};">#{0}{1}{2}{3:>02}</span>\n'.format(hex(r)[2:], hex(v)[2:], hex(b)[2:], hex(c[6])[2:])
        f.write(d)
    f.write('</body></html>')
    f.flush()
    f.close()

def readWDS(data):
    print('> window')
    data=DataReader(data)
    numberOfWindows=int.from_bytes(data.consume(1))
    windowID=int.from_bytes(data.consume(1))
    windowHorizontalPositon=int.from_bytes(data.consume(2))
    windowVerticalPositon=int.from_bytes(data.consume(2))
    windowWidth=int.from_bytes(data.consume(2))
    windowHeight=int.from_bytes(data.consume(2))
    print('nOW:{} wID:{} wHP:{} wVP:{} wW:{} wH:{}'.format(numberOfWindows, windowID, windowHorizontalPositon, windowVerticalPositon, windowWidth, windowHeight))

def readPCS(data):
    print('> presentation')
    data=DataReader(data)
    width=int.from_bytes(data.consume(2))
    height=int.from_bytes(data.consume(2))
    framRate=int.from_bytes(data.consume((1)))
    compositionNumber=int.from_bytes(data.consume(2))
    compositionState=data.consume(1)
    paletteUpdateFlag=data.consume(1)
    paletteID=int.from_bytes(data.consume(1))
    numberOfCompositionObjects=int.from_bytes(data.consume(1))
    objectID=int.from_bytes(data.consume(2))
    windowID=int.from_bytes(data.consume(1))
    objectCroppedFlag=int.from_bytes(data.consume(1))
    objectHorizontalPosition=int.from_bytes(data.consume(2))
    objectVerticalPosition=int.from_bytes(data.consume(2))
    [objectCroppingHorizontalPosition, objectCroppingVerticalPosition,
    objectCroppingWidth, objectCroppingHeightPosition]= [0, 0, 0, 0]
    if ( objectCroppedFlag == b'\x40' ):
        objectCroppingHorizontalPosition=int.from_bytes(data.consume(2))
        objectCroppingVerticalPosition=int.from_bytes(data.consume(2))
        objectCroppingWidth=int.from_bytes(data.consume(2))
        objectCroppingHeightPosition=int.from_bytes(data.consume(2))
    print('w:{} h:{} fr:{} cN:{} cS:{} pUF:{} pID:{}'.format(width, height, framRate, compositionNumber, compositionState, paletteUpdateFlag, paletteID))
    print('nOCO:{} oID:{} wID:{} oCf:{} oHP:{} oVP:{} oCHP:{} oCVP:{} oCW:{} oCHP:{}'.format(numberOfCompositionObjects, objectID, windowID, objectCroppedFlag, objectHorizontalPosition, objectVerticalPosition, objectCroppingHorizontalPosition, objectCroppingVerticalPosition, objectCroppingWidth, objectCroppingHeightPosition))
    # print(data.pointer)

ColorRGB=namedtuple('ColorRGB', 'r g b')

def validateRange(value):
    if (value < 0): return 0
    if (value > 255): return 255
    return value

def yuv2rgb(yuv):
    rgb=[]
    for c in yuv:
        valid=list(map(validateRange, (
                int(c.y+1.402*(c.cr-128)),
                int(c.y-0.34414*(c.cb-128)-0.71414*(c.cr-128)),
                int(c.y+1.772*(c.cb-128))
                )))
        rgb.append(ColorRGB(*valid))
    return rgb

def readSegment(n):
    global ods_count
    header=supfile.read(2)
    if ( not header ): return False
    print('.segment: {}'.format(n+1))
    if ( header != b'PG' ):
        print(header)
        print('not a sup file, abort.')
        sys.exit(1)
    pts=int.from_bytes(supfile.read(4))/90
    # print(pts)
    dts=int.from_bytes(supfile.read(4))
    segtype=supfile.read(1)
    segsize=supfile.read(2)
    subdata=supfile.read(int.from_bytes(segsize))
    palette=[]

    if ( segtype == b'\x14' ):
        segtype='PDS'
        palette=readPDS(subdata)
        palette=yuv2rgb(palette)
    elif ( segtype == b'\x15' ):
        segtype='ODS'
        ods_count+=1
        readODS(subdata, palette)
    elif ( segtype == b'\x16' ):
        segtype='PCS'
        readPCS(subdata)
    elif ( segtype == b'\x17' ):
        segtype='WDS'
        readWDS(subdata)
    elif ( segtype == b'\x80' ):
        segtype='END'
        readEnd(subdata)
    else:
        print(str(segtype))
        print('Wrong segment type, abort.')
        sys.exit(1)

    # always 0
    return True

ods_count=0
while readSegment(count):
    print()
    count+=1
    if ( count > max_count ): break

supfile.close()