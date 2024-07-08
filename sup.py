#!/usr/bin/env python3
# -*- coding: UTF8 -*-
# most information was collected from:
# https://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/
# find a copy into doc sub folder

import sys, os, itertools, argparse
from PIL import Image, ImageDraw, ImageShow
from collections import namedtuple

cliParser=argparse.ArgumentParser(
    prog='sup.py',
    description='PGS .sup file reader',
    epilog='have bien le fun'
    )
cliParser.add_argument('filename')
cliParser.add_argument('-c', '--colorize', action='store_true', default='store_false')
cliParser.add_argument('-d', '--debug', action='store_true', default='store_false')
cliArgs=cliParser.parse_args()

enable_debug=cliArgs.debug
enable_colorize=cliArgs.colorize
if (os.path.isfile(cliArgs.filename)):
    filename=cliArgs.filename
    supfile=open(filename, 'rb')
else:
    print(f'File \'{cliArgs.filename}\' does not exist, abort.')
    sys.exit(1)

# check header
if ( supfile.read(2) != b'PG' ):
    print('Wrong header file, this file does not seems to be a sup file, abort.')
    sys.exit(1)
else:
    supfile.seek(0)

c_yellow='\033[0;33m'
c_white='\033[1;37m'
c_green='\033[0;32m'
c_cyan='\033[0;36m'
c_red='\033[0;31m'
c_blue='\033[0;34m'
c_term_reset='\033[0m'

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
        self.draw=ImageDraw.Draw(self.image)

    def drawLine(self, color, length):
        # print(color, length)
        # drawing line
        self.draw.line(
            [(self.x, self.y), (self.x+length, self.y)],
            fill=(color), width=1, joint=None
        )
        self.x+=length

    def nextLine(self):
        self.x=0
        self.y+=1

# image=Image.new('P', (100,100), 255)
# drawer=ImageDraw.Draw(image)
# drawer.line((0, 10), fill=0, width=1, joint=None)
# image.putpalette((255,0,0))
# image.save('/tmp/coin.png')
# image.close()

def readObject(image, bytes):
    # C: color, L: length, 0: default color
    # 1 byte : CCCCCCCC
    # 2 bytes: 00000000 00LLLLLL
    # 3 bytes: 00000000 01LLLLLL LLLLLLLL
    # 3 bytes: 00000000 10LLLLLL CCCCCCCC
    # 4 bytes: 00000000 11LLLLLL LLLLLLLL CCCCCCCC
    # 2 bytes: 00000000 00000000 end of line

    drawer=Drawer(image)
    # bytes_split=[ '{:02x}'.format(bytes[n]) for n in range(0, len(bytes[0:100]))]
    # for n in range(0, len(bytes_split)):
    #     if ( (n % 10) == 0):
    #         print('')
    #     else:
    #         print(f'{bytes_split[n:n+10]}')

    n=0
    while n < len(bytes):
        # print('bytes: ', bytes[n:n+4])
        if (bytes[n]):
            # one byte, isolated colored pixel
            length=0
            color=bytes[n]
            drawer.drawLine(color, length)
            # shift byte position
            n+=1
        else:
            # define default color
            color=255
            # keep witness and go to next byte
            witness=bytes[n]
            n+=1
            # print('bytes: ', bytes[n:n+4])
            if witness == 0:
                # new line encountered
                drawer.nextLine()
                n+=1
            elif witness < 64:
                # two bytes, default color with shorter sequence
                # 000000 00LLLLLL
                length=witness
                drawer.drawLine(color, length)
                n+=1
            elif witness < 128:
                # three bytes, default color with longer sequence
                # 00000000 01LLLLLL LLLLLLLL
                length=((witness-64)<<8)+bytes[n+1]
                # print('>> ', length)
                drawer.drawLine(color, length)
                n+=2
            elif witness < 192:
                # three bytes, with define color shorter sequence
                # 000000 10LLLLLL CCCCCCCC
                color=bytes[n+1]
                length=witness-128
                # print('>>> ', length)
                drawer.drawLine(color, length)
                n+=2
            else:
                # four bytes, with define color longer sequence
                # 00000000 11LLLLLL LLLLLLLL CCCCCCCC
                # print('w: ', witness)
                # print('b: ', bytes[n+1])
                color=bytes[n+2]
                length=((witness-192)<<8)+bytes[n+1]
                # print('l: ', length)
                # print('>>>> ', length)
                drawer.drawLine(color, length)
                n+=3

def colorize(color, alternative):
    if (enable_colorize): return alternative
    return color

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

def validateRange(value):
    if (value < 0): return 0
    if (value > 255): return 255
    return value

pgs=namedtuple('PresentationGraphicStream', ('pts dts ds'))
pcs=namedtuple('PresentationCompositionSegment', ([
    'video_width', 'video_height',
    'frame_rate', 'comp_n',
    'comp_state', 'palette_update',
    'palette_id', 'nof_obj',
    'obj_id', 'window_id',
    'obj_crop',
    'obj_posx', 'obj_posy',
    'obj_crop_posx', 'obj_crop_posy',
    'obj_crop_width', 'obj_crop_height'
]))
wds=namedtuple('WindowDefinitionSegment', ('nof id posx posy width height'))
pds=namedtuple('PaletteDefinitionSegment', (['id', 'version', 'palette']))
ods=namedtuple('ObjectDefinitionSegment', 'id version last data_size width height obj_data')
ds=namedtuple('DisplaySet', ('pcs wpo_list'))
wpo=namedtuple('WindowPaletteObject', ('wds pds ods'))
end=namedtuple('END', (''))

def readWDS(bytes):
    '''
    1 byte,  Number of windows: Number of windows defined in this segment
    1 byte,  Window ID: ID of this window
    2 bytes, Window horizontal position: X offset from the top left pixel of the window in the screen
    2 bytes, Window vertical position: Y offset from the top left pixel of the window in the screen
    2 bytes, Window width: Width of the window
    2 bytes, Window height: Height of the window
    '''
    return wds(
        int.from_bytes(bytes[0:1]),
        int.from_bytes(bytes[1:2]),
        int.from_bytes(bytes[2:4]),
        int.from_bytes(bytes[4:6]),
        int.from_bytes(bytes[6:8]),
        int.from_bytes(bytes[8:10])
    )

def readPCS(bytes):
    '''
    2 bytes, object ID: ID of the ODS segment that defines the image to be shown
    1 byte,  window ID: Id of the WDS segment to which the image is allocated in the PCS, maximum 2 images.
    1 byte,  object cropped flag: 0x40: Force display of the cropped image object 0x00: Off
    2 bytes, object horizontal position: X offset from the top left pixel of the image on the screen
    2 bytes, object vertical position: Y offset from the top left pixel of the image on the screen
    2 bytes, object cropping horizontal position: X offset from the top left pixel of the cropped object in the screen. Only used when the Object Cropped Flag is set to 0x40
    2 bytes, Object Cropping Vertical Position: Y offset from the top left pixel of the cropped object in the screen. Only used when the Object Cropped Flag is set to 0x40
    2 bytes, Object Cropping Width: Width of the cropped object in the screen. Only used when the Object Cropped Flag is set to 0x40
    2 bytes, Object Cropping Height Position: Heightl of the cropped object in the screen. Only used when the Object Cropped Flag is set to 0x40
    '''
    cropping=(0, 0, 0, 0)
    if ( bytes[14] == b'\x40' ):
        cropping=(
            int.from_bytes(bytes[19:21]),
            int.from_bytes(bytes[21:23]),
            int.from_bytes(bytes[23:25]),
            int.from_bytes(bytes[25:27])
        )
    return pcs(
        int.from_bytes(bytes[:2]),
        int.from_bytes(bytes[2:4]),
        int.from_bytes(bytes[4:5]),
        int.from_bytes(bytes[5:7]),
        bytes[7:8],
        bytes[8:9],
        int.from_bytes(bytes[9:10]),
        int.from_bytes(bytes[10:11]),
        int.from_bytes(bytes[11:13]),
        int.from_bytes(bytes[13:14]),
        int.from_bytes(bytes[14:15]),
        int.from_bytes(bytes[15:17]),
        int.from_bytes(bytes[17:19]),
        *cropping
    )

def readPDS(bytes):
    # Palette Definition Segment
    ############################
    # 1 byte, ID: ID of the palette
    # 1 byte, Version Number: Version of this palette within the Epoch
    # ------- Following entries can be repeated
    # 1 byte, Entry ID: Entry number of the palette
    # 1 byte, Luminance (Y): Luminance (Y value)
    # 1 byte, Color Difference Red (Cr): Color Difference Red (Cr value)
    # 1 byte, Color Difference Blue (Cb): Color Difference Blue (Cb value)
    # 1 byte, Transparency (Alpha): Transparency (Alpha value)

    # build empty palette YCrCb + alpha (black)
    palette_alpha=[(0, 0, 0, 0)]*256
    palette=[(0, 0, 0)]*256
    id=int.from_bytes(bytes[0:1])
    version=int.from_bytes(bytes[1:2])
    n=0
    while (n <= len(bytes[2:])):
        entry=int.from_bytes(bytes[n:n+1])
        # YCrCb to RGB conversion
        y,cr,cb=int.from_bytes(bytes[n+1:n+2]), int.from_bytes(bytes[n+2:n+3]), int.from_bytes(bytes[n+3:n+4])
        palette[entry]=(
            validateRange(int(y+1.402*(cr-128))),
            validateRange(int(y-0.34414*(cb-128)-0.71414*(cr-128))),
            validateRange(int(y+1.772*(cb-128))),
            # alpha channel
            # int.from_bytes(bytes[n+4:n+5])
        )
        n+=5
    return pds(id, version, list(itertools.chain.from_iterable(palette)))

def readODS(bytes):
    return ods(
        int.from_bytes(bytes[:2]),
        int.from_bytes(bytes[2:3]),
        bytes[3:4],
        int.from_bytes(bytes[4:7]),
        int.from_bytes(bytes[7:9]),
        int.from_bytes(bytes[9:11]),
        bytes[11:]
    )

segment_count=0
max_segment=4
ds_count=0
max_ds=2
# current display set
currentDS={'pcs': None, 'wpo_list': []}
currentWPO={'wds': None, 'pds': None, 'ods': None}

while True:
    '''
    PGS: Presentation Graphic Stream
    2 bytes, Magic Number: "PG" (0x5047)
    4 bytes, PTS: Presentation Timestamp (milliseconds with a frequency 90kHz)
    4 bytes, DTS: Decoding Timestamp (milliseconds with a frequency 90kHz)
    1 byte,  Segment Type: 0x14: PDS, 0x15: ODS, 0x16: PCS, 0x17: WDS, 0x80: END
    2 bytes, Segment Size: Size of the segment
    |PCS|
            |WDS|PDS|ODS| |WDS|PDS|ODS| … |WDS|PDS|ODS|
    |END|
    '''
    # bytes must be slice everytimes, if not an integer is return
    # bytes[0] != bytes[0:1] because bytes[0] convert into integer
    bytes=supfile.read(13)
    magicNumber=bytes[:2]
    if not magicNumber: break
    pts=int.from_bytes(bytes[2:6])/90
    dts=int.from_bytes(bytes[6:10])/90
    segtype=bytes[10:11]
    size=bytes[11:13]
    subData=supfile.read(int.from_bytes(size))

    if ( segtype == b'\x14' ):
        # PDS
        palette=readPDS(subData)
        currentWPO['pds']=palette
    elif ( segtype == b'\x15' ):
        # ODS
        objectDefinitionSegment=readODS(subData)
        currentWPO['ods']=objectDefinitionSegment
        # add current WPO to current display set
        currentDS['wpo_list'].append(wpo(**currentWPO))
        # reset current Window Palette Object
        currentWPO={'wds': None, 'pds': None, 'ods': None}
    elif ( segtype == b'\x16' ):
        # PCS
        presentationCompositionSegment=readPCS(subData)
        currentDS['pcs']=presentationCompositionSegment
    elif ( segtype == b'\x17' ):
        # WDS
        windowDefinitionSegment=readWDS(subData)
        currentWPO['wds']=windowDefinitionSegment
    elif ( segtype == b'\x80' ):
        # END
        # create image with current display set
        n=0
        # print(currentDS)
        while n < currentDS['pcs'].nof_obj:
            win_size=(currentDS['wpo_list'][n].ods.width, currentDS['wpo_list'][n].ods.height)
            obj_bytes=currentDS['wpo_list'][n].ods.obj_data
            palette=currentDS['wpo_list'][n].pds.palette
            image = Image.new('P', win_size, 255)
            readObject(image, obj_bytes)
            # print(len(palette))
            # image.putpalette(palette)
            image.putpalette((255,0,128))
            image.save(f'/tmp/image-{ds_count:04d}.png')
            print(f'/tmp/image-{ds_count:04d}.png saved.')
            image.close()
            n+=1
        # reset display set
        currentDS={pcs: None, 'wpo_list': None}
        ds_count+=2
        if ( ds_count >= max_ds ): break

    else:
        print(f'Unknown segment type ({segtype}), skipping.')
    # segment_count+=1
    # if segment_count >= max_segment:
        # print(currentDS)
        # break
