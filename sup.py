#!/usr/bin/env python3
# -*- coding: UTF8 -*-
# most information was collected from:
# https://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/
# find a copy into doc sub folder

import sys, os, itertools, argparse, datetime, math
from PIL import Image, ImageDraw, ImageShow
from collections import namedtuple

cliParser=argparse.ArgumentParser(
    prog=os.path.basename(sys.argv[0]),
    description='PGS .sup file reader',
    epilog='have bien le fun'
)
cliParser.add_argument('filename')
cliParser.add_argument('-c', '--columns', action='store', default=4, type=int)
cliParser.add_argument('-d', '--debug', action='store_true', default='store_false')
cliParser.add_argument('-r', '--rows', action='store', default=128, type=int)
cliArgs=cliParser.parse_args()

enable_debug=cliArgs.debug
if (os.path.isfile(cliArgs.filename)):
    filename=cliArgs.filename
    basename=os.path.basename(filename)
    supfile=open(filename, 'rb')
    # define image prefix
    image_prefix=os.path.splitext(basename)[0]+'-'
    image_extension='png'
    # define webvtt filename
    webvtt_filename=os.path.splitext(basename)[0]+'.vtt'
    pack_vobsub_prefix=os.path.splitext(basename)[0]+'-'
    pack_vobsub_extension='vobsub.png'
else:
    print(f'File \'{cliArgs.filename}\' does not exist, abort.')
    sys.exit(1)
rows, columns = cliArgs.rows, cliArgs.columns
test_maxbytes = 256

def search_nof_subs(read_bytes):
    n, maxbytes = 0, len(read_bytes)
    while n < maxbytes:
        n += 1
        byte = read_bytes[maxbytes-n:maxbytes-n+1]
        if ( byte == b'G' ):
            n += 1
            byte = read_bytes[maxbytes-n:maxbytes-n+1]
            if ( byte == b'P' ):
                pgs_offset = 13
                pgs = read_bytes[maxbytes-n:maxbytes-n+pgs_offset]
                if ( pgs[10:11] == b'\x16' ):
                    pcs_size = int.from_bytes(pgs[11:13])
                    pcs_bytes = read_bytes[maxbytes-n+pgs_offset:maxbytes-n+pgs_offset+pcs_size]
                    w=int.from_bytes(pcs_bytes[:2])
                    h=int.from_bytes(pcs_bytes[2:4])
                    composition_number=int.from_bytes(pcs_bytes[5:7])
                    return f'{w}x{h} {(composition_number//2)+1:d}'
    else:
        return ''

# check supfile header, search PG 0x50,0x47
if ( supfile.read(2) != b'PG' ):
    print('Wrong header file, this file does not seems to be a sup file, abort.')
    sys.exit(1)
else:
    # seek to last byte available
    supfile.seek(-test_maxbytes, 2)
    # save lasts bytes
    read_bytes = supfile.read(test_maxbytes)
    supfile_info = search_nof_subs(read_bytes)
    supfile.seek(0)

PCS={
    'compositionState': {
        b'\x00': 'normal',
        b'\x40': 'acquisition_point',
        b'\x80': 'epoch_start',
    },
    'objectCroppedFlag': {
        b'\x40': True,
        b'\x00': False,
    }
}

pgs=namedtuple('PresentationGraphicStream', 'pts dts ds')
pcs=namedtuple('PresentationCompositionSegment', [
    'video_width', 'video_height',
    'frame_rate', 'comp_n',
    'comp_state', 'timestamp',
    'palette_update', 'palette_id',
    'nof_obj', 'co'
])
wds=namedtuple('WindowDefinitionSegment', 'nof id posx posy width height')
pds=namedtuple('PaletteDefinitionSegment', 'id version palette')
ods=namedtuple('ObjectDefinitionSegment', 'id version last data_size width height obj_data')
ds = namedtuple('DisplaySet', 'pcs wpo_list')
wpo=namedtuple('WindowPaletteObject', 'wds pds ods')
end=namedtuple('END', '')
co=namedtuple('CompositionObject', 'id window_id cropped_flag pos_x pos_y crop_pos_x crop_pos_y crop_width crop_height')
packDescription=namedtuple('packOfSub', 'subfile begin end')

class Drawer:
    def __init__(self, image):
        self.image=image
        self.x=0
        self.y=0
        self.draw=ImageDraw.Draw(self.image)

    def drawLine(self, color, length):
        # drawing line
        self.draw.line(
            [(self.x, self.y), (self.x+length, self.y)],
            fill=(color), width=1, joint=None
        )
        self.x+=length

    def nextLine(self):
        self.x=0
        self.y+=1

class PackImages:

    def __init__(self, total_images, prefix='img-', extension='png', rows=128, columns=4):
        self.rows, self.columns, self.total_images=rows, columns, total_images
        self.driftX, self.driftY, self.count, self.largest=0, 0, 0, 0
        self.prefix, self.extension=prefix, extension
        self.nof_pack = math.ceil(self.total_images / ( self.rows * self.columns ))
        self.int_width=f'0{len(str(self.nof_pack))}d'
        self.packs, self.current_pack = [], None
        self.current_column, self.column_count=[], 0

    def currentPack(self):
        # return current pack number
        return self.count//(self.rows*self.columns)

    def filename(self):
        # return vobsub filename against current packing file
        return f'{self.prefix}{self.currentPack():{self.int_width}}.{self.extension}'

    def startPack(self):
        self.current_pack=[self.filename(), f'{self.count:04d}']

    def endPack(self):
        self.current_pack.append(f'{self.count:04d}')
        self.packs.append(packDescription(*self.current_pack))
        self.current_pack=None

    def getCues(self, width, height):
        if not self.current_pack: self.startPack()
        # return string containing file pack, with corresponding drift X and Y
        if width > self.largest: self.largest=width

        if not (self.count) % (self.rows * self.columns):
            # changing pack file
            self.endPack()
            # reset drift and largest
            self.driftX, self.driftY, self.largest = 0, 0, 0
        elif not (self.count) % self.rows:
            # change column into current pack
            self.driftX+=self.largest
            self.largest=0
            self.driftY=0

        output=f'{self.filename()} {width}×{height}:{self.driftX}:{self.driftY}'
        self.driftY+=height
        self.count+=1
        return output

    def makeImage(self, ds):
        ''' Create image with a display set
            return cue content from PackImage.getCues()
        '''
        n=0
        while n < ds['pcs'].nof_obj:
            win_size=(ds['wpo_list'][n].ods.width, ds['wpo_list'][n].ods.height)
            obj_bytes=ds['wpo_list'][n].ods.obj_data
            palette=ds['wpo_list'][n].pds.palette
            image = Image.new('P', win_size, 255)
            readObject(image, obj_bytes)
            image.putpalette(palette)
            image_filepath=f'/tmp/{image_prefix}{ds['pcs'].comp_n//2:04d}.{image_extension}'
            image.save(image_filepath)
            image.close()
            n+=1
            # print(f'{image_filepath} saved.', end='\r')
        return pack.getCues(win_size[0], win_size[1])

def validateRange(value):
    if (value < 0): return 0
    if (value > 255): return 255
    return value

def redChannel(y, cr):
    # red channel from y and cr channels
    return validateRange(int(y+1.402*(cr-128)))

def greenChannel(y, cb, cr):
    # green channel from y, cb and cr channels
    return validateRange(int(y-0.34414*(cb-128)-0.71414*(cr-128)))

def blueChannel(y, cb):
    # blue channel from y and cb channels
    return validateRange(int(y+1.772*(cb-128)))

def readObject(image, bytes):
    '''
    C: color, L: length, 0: default color
    1 byte : CCCCCCCC
    2 bytes: 00000000 00LLLLLL
    3 bytes: 00000000 01LLLLLL LLLLLLLL
    3 bytes: 00000000 10LLLLLL CCCCCCCC
    4 bytes: 00000000 11LLLLLL LLLLLLLL CCCCCCCC
    2 bytes: 00000000 00000000 end of line
    '''

    drawer=Drawer(image)
    n=0
    while n < len(bytes):
        if (bytes[n]):
            # one byte, isolated colored pixel
            length=1
            color=bytes[n]
            drawer.drawLine(color, length)
            # shift byte position
            n+=1
        else:
            # define default color
            color=255
            # keep witness and go to next byte
            witness=bytes[n+1]
            n+=1
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
                drawer.drawLine(color, length)
                n+=2
            elif witness < 192:
                # three bytes, with define color shorter sequence
                # 000000 10LLLLLL CCCCCCCC
                color=bytes[n+1]
                length=witness-128
                drawer.drawLine(color, length)
                n+=2
            else:
                # four bytes, with define color longer sequence
                # 00000000 11LLLLLL LLLLLLLL CCCCCCCC
                color=bytes[n+2]
                length=((witness-192)<<8)+bytes[n+1]
                drawer.drawLine(color, length)
                n+=3

def readWDS(bytes):
    ''' Window Definition Object
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

def readCO(bytes):
    ''' Composition Object
    0 2 bytes, object ID: ID of the ODS segment that defines the image to be shown
    2 1 byte,  window ID: Id of the WDS segment to which the image is allocated in the PCS, maximum 2 images.
    3 1 byte,  object cropped flag: 0x40: Force display of the cropped image object 0x00: Off
    4 2 bytes, object horizontal position: X offset from the top left pixel of the image on the screen
    6 2 bytes, object vertical position: Y offset from the top left pixel of the image on the screen
    8 2 bytes, object cropping horizontal position: X offset from the top left pixel of the cropped object in the screen. Obj Crop Flag: 0x40
    10 2 bytes, object cropping vertical position: Y offset from the top left pixel of the cropped object in the screen. Obj Crop Flag: 0x40
    12 2 bytes, object cropping width: width of the cropped object in the screen. Only used when the Obj Crop Flag: 0x40
    14 2 bytes, object cropping height position: height of the cropped object in the screen. Only used when the Obj Crop Flag: 0x40
    '''
    cropping=(0, 0, 0, 0)
    if ( bytes[3:4] == b'\x40' ):
        cropping=(
            int.from_bytes(bytes[8:10]),  # obj. crop. pos. x
            int.from_bytes(bytes[10:12]),  # obj. crop. pos. y
            int.from_bytes(bytes[12:14]),  # obj. crop. width
            int.from_bytes(bytes[14:16]),  # obj. crop. height
        )
    return co(
        int.from_bytes(bytes[0:2]), # object ID
        bytes[3], # window ID
        PCS['objectCroppedFlag'][bytes[3:4]], # obj. crop. flag
        int.from_bytes(bytes[4:6]), # obj. pos. x
        int.from_bytes(bytes[6:8]), # obj. pos. y
        *cropping
    )

def readPCS(bytes, pts):
    ''' Presentation Composition Segment
    0  2 bytes, video width
    2  2 bytes, video height
    4  1 bytes, frame rate, always 0x10, can be ignored
    5  2 bytes, composition number
    7  1 bytes, composition state [0x00, 0x40, 0x80]:[normal, acquisition point, epoch start]
    8  1 bytes, palette update flag
    9  1 bytes, palette ID
    10 1 bytes, number of composition objects
    '''
    n_of_co=bytes[10]
    composition_obj=(0, 0, 0, 0, 0, 0, 0, 0, 0)
    if n_of_co: composition_obj=readCO(bytes[11:])
    return pcs(
        int.from_bytes(bytes[:2]), # video width
        int.from_bytes(bytes[2:4]), # video height
        bytes[4], # frame rate
        int.from_bytes(bytes[5:7]), # composition number
        PCS['compositionState'][bytes[7:8]], # composition state
        ms2time(pts),
        bool(bytes[8]), # palette update flag
        bytes[9], # palette ID
        n_of_co, # number of composition objects
        composition_obj
    )

def readPDS(bytes):
    ''' Palette Definition Segment
    1 byte, ID: ID of the palette
    1 byte, Version Number: Version of this palette within the Epoch
    ------- Following entries can be repeated
    1 byte, Entry ID: Entry number of the palette
    1 byte, Luminance (Y): Luminance (Y value)
    1 byte, Color Difference Red (Cr): Color Difference Red (Cr value)
    1 byte, Color Difference Blue (Cb): Color Difference Blue (Cb value)
    1 byte, Transparency (Alpha): Transparency (Alpha value)
    '''

    # build empty palette YCrCb + alpha (black)
    palette_alpha=[(0, 0, 0, 0)]*256
    # define default rgb colors
    palette=[(redChannel(0, 0), greenChannel(0, 0, 0), blueChannel(0, 0))]*256
    id=bytes[0]
    version=bytes[1]
    bytes=bytes[2:]
    n=0
    while (n < len(bytes)):
        entry=bytes[n]
        # YCrCb to RGB conversion
        y,cr,cb,a=bytes[n+1], bytes[n+2], bytes[n+3], bytes[n+4]
        palette[entry]=(redChannel(y, cr), greenChannel(y, cb, cr), blueChannel(y, cb))
        n+=5
    return pds(id, version, list(itertools.chain.from_iterable(palette)))

def readODS(bytes):
    ''' Object Definition Segment
    '''
    return ods(
        int.from_bytes(bytes[:2]),
        int.from_bytes(bytes[2:3]),
        bytes[3:4],
        int.from_bytes(bytes[4:7]),
        int.from_bytes(bytes[7:9]),
        int.from_bytes(bytes[9:11]),
        bytes[11:]
    )

def ms2time(milliseconds):
    ''' Convert milliseconds into string time like: HH:MM:SS.mm'''
    time=str(datetime.timedelta(milliseconds=milliseconds)).split('.')
    if len(time) > 1:
        ms=time[1][:-3]
    else:
        ms='000'
    return '{:>02s}:{}:{}.{}'.format(*time[0].split(':'), ms)

# current display set
currentDS={'pcs': None, 'wpo_list': []}
currentWPO={'wds': None, 'pds': None, 'ods': None}
current_webvtt_cue=[]
pack=PackImages(1892, prefix=pack_vobsub_prefix, extension=pack_vobsub_extension, rows=rows, columns=columns)
last_image_processed=None
webvtt_file=open(webvtt_filename, 'w')
webvtt_file.write(f'WEBVTT - {basename}\n')
webvtt_file.write(f'NOTE file generated with {cliParser.prog} {str(datetime.datetime.now()).split('.')[0]}')
while True:
    '''
    PGS: Presentation Graphic Stream
    2 bytes, Magic Number: "PG" (0x50 0x47)
    4 bytes, PTS: Presentation Timestamp (milliseconds with a frequency 90kHz)
    4 bytes, DTS: Decoding Timestamp (milliseconds with a frequency 90kHz)
    1 byte,  Segment Type: 0x14: PDS, 0x15: ODS, 0x16: PCS, 0x17: WDS, 0x80: END
    2 bytes, Segment Size
    |PCS|
            |WDS|PDS|ODS| |WDS|PDS|ODS| … |WDS|PDS|ODS|
    |END|
    or
    |PCS|WDS|END|
    '''
    # Read PGS header
    bytes=supfile.read(13)
    magicNumber=bytes[:2]
    if not magicNumber: break
    pts=int.from_bytes(bytes[2:6])/90
    dts=int.from_bytes(bytes[6:10])/90
    segtype=bytes[10:11]
    size=int.from_bytes(bytes[11:13])
    subData=supfile.read(size)
    # handle segment by its type
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
        presentationCompositionSegment=readPCS(subData, pts)
        if presentationCompositionSegment.comp_state == 'epoch_start':
            current_webvtt_cue=[(presentationCompositionSegment.comp_n//2)+1, ms2time(pts)]
        else:
            current_webvtt_cue.insert(2, ms2time(pts))
        currentDS['pcs']=presentationCompositionSegment
    elif ( segtype == b'\x17' ):
        # WDS
        windowDefinitionSegment=readWDS(subData)
        currentWPO['wds']=windowDefinitionSegment
    elif ( segtype == b'\x80' ):
        # END
        # PCS with empty object is an end of the current subtitle
        if currentDS['pcs'].nof_obj != 0:
            current_webvtt_cue.append(pack.makeImage(currentDS))
            continue
        # end of the current subtitle, so write it
        webvtt_file.write('\n\n{0}\n{1} --> {2}\n{3}'.format(*current_webvtt_cue))
        # reset display set
        currentDS={'pcs': None, 'wpo_list': []}
    else:
        print(f'Unknown segment type ({segtype}), skipping.')

print(f'\n{pack.count} image saved.')
webvtt_file.close()
print(f'{webvtt_filename} created.')
pack.endPack()

path='/tmp/'
rows_prefix='rows-'
pack_prefix=image_prefix
pack_file_format=f'{path}{pack_prefix}{{:02d}}{pack_vobsub_extension}'
rows_file_format=f'{path}{rows_prefix}{{:02d}}{pack_vobsub_extension}'
single_column=namedtuple('APackOfRows', 'filename begin end')
format_width=len(str(pack.count))
string_format=f'{{:0{format_width}d}}'
nof_pack=pack.count//rows

# pack rows
print('pack rows…')
cmd='bash -c "convert {}{}{{{:04d}..{:04d}}}.{} -append {}{}{:02d}.{}"'
for n in range(0, nof_pack):
    os.system(cmd.format(path, image_prefix, n*rows, ((n+1)*rows)-1, image_extension, path, rows_prefix, n, image_extension))
if ( pack.count % rows ) > 0:
    os.system(cmd.format(path, image_prefix, nof_pack*rows, pack.count-1, image_extension, path, rows_prefix, nof_pack, image_extension))

# final pack:rows*columns
print('pack final image and add transparency…')
nof_image=nof_pack
nof_pack=nof_image//columns
cmd='bash -c "convert {}{}{{{:02d}..{:02d}}}.{} +append {}{}{}.{}"'
filter='bash -c "mogrify -transparent \'rgb(0, 135, 0)\' -transparent \'rgb(255, 255, 255)\' {}{}{}.{}"'
for n in range(0, nof_pack):
    os.system(cmd.format(path, rows_prefix, n*columns, ((n+1)*columns-1), image_extension, path, pack_prefix, n, pack_vobsub_extension))
    os.system(filter.format(path, pack_prefix, n, pack_vobsub_extension))
if ( nof_image % columns ) > 0:
    os.system(cmd.format(path, rows_prefix, nof_pack*columns, nof_image, image_extension, path, pack_prefix, nof_pack, pack_vobsub_extension))
    os.system(filter.format(path, pack_prefix, n, pack_vobsub_extension))

# TODO: handle when number of image generated are less than rows, so only one file needed