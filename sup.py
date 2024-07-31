#!/usr/bin/env python3
# -*- coding: UTF8 -*-
# most information was collected from:
# https://blog.thescorpius.com/index.php/2017/07/15/presentation-graphic-stream-sup-files-bluray-subtitle-format/
# find a copy into doc sub folder
# NOTE: 'nof' mean 'number of'

import sys, os, itertools, argparse, datetime, math, tempfile
from PIL import Image, ImageDraw
from collections import namedtuple
# from wand.image import Image as wimage
# from wand.drawing import Drawing as wdrawing
# from wand.color import Color as wcolor

cliParser=argparse.ArgumentParser(
    prog=os.path.basename(sys.argv[0]),
    description='PGS .sup file reader',
    epilog='have bien le fun'
)
cliParser.add_argument('filename')
cliParser.add_argument('-c', '--columns', action='store', default=4, type=int)
cliParser.add_argument('-d', '--debug', action='store_true', default='store_false')
cliParser.add_argument('-r', '--rows', action='store', default=128, type=int)
cliParser.add_argument('-l', '--limit', action='store', default=9999, type=int)
cliParser.add_argument('-t', '--targetDirectory', action='store', default=os.getcwd(), type=str)
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
    pack_prefix=os.path.splitext(basename)[0]+'-'
    pack_extension='png'
else:
    print(f'File \'{cliArgs.filename}\' does not exist, abort.')
    sys.exit(1)
if not os.path.isdir(cliArgs.targetDirectory):
    print('Destination folder does not exist, abort.')
    sys.exit(1)
rows, columns = cliArgs.rows, cliArgs.columns
test_maxbytes = 256

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
packDescription=namedtuple('packOfSub', 'packFilename columns')
packColumnDescription=namedtuple('PackOfSubtitleRows', 'columnFilename begin end')
LINE_CLEAR='\x1b[2K'

class Drawer:
    def __init__(self, image):
        self.image= image
        self.x, self.y = 0, 0
        self.draw=ImageDraw.Draw(self.image)

    def drawLine(self, colorIndex, length):
        # drawing line
        self.draw.line(
            [(self.x, self.y), (self.x+length, self.y)],
            fill=(colorIndex), width=1, joint=None
        )
        self.x+=length

    def nextLine(self):
        self.x=0
        self.y+=1

class PackImages:

    def __init__(self, total_images, prefix = 'subtitle-', extension='png', rows=128, columns=4):
        self.nof_rows, self.nof_columns, self.total_images, self.pack_size = rows, columns, total_images, rows * columns
        self.driftX, self.driftY, self.count, self.largest = 0, 0, 0, 0
        self.prefix, self.extension, self.subtitle_prefix = prefix, extension, 'subtitle-'
        self.packColumnPrefix='column-'
        self.nof_pack = math.ceil(self.total_images / self.pack_size)
        self.subtitle_format = f'0{len(str(self.total_images))}d'
        self.pack_format = f'0{len(str(self.nof_pack))}d'
        self.packs, self.current_pack = [], []
        self.current_column, self.column_count = [], 0
        self.pack_count=0
        self.tmpd = tempfile.TemporaryDirectory(prefix=f'{cliParser.prog}-', delete=not enable_debug)

        self.startPack()

    def absolutePath(self, filename=''):
        return os.path.join(self.tmpd.name, filename)

    def packFilename(self):
        # return string representing one bitmap subtitle filename against current packing number
        return f'{self.prefix}{self.pack_count:{self.pack_format}}.{self.extension}'

    def columnFilename(self):
        return f'{self.packColumnPrefix}{self.column_count}.{self.extension}'

    def startPack(self):
        ''' Define a new list containing first the pack filename
            followed by subtitle image start number
            Returns list
        '''
        self.pack_count+=1
        self.current_pack=[self.packFilename(), []]
        self.startColumn()

    def endPack(self):
        ''' Terminate pack definition by appending to the list the subtitle image number.
            Create a corresponding packDescription, append it to self.packs list.
            Reseting current pack
        '''
        self.endColumn()
        self.packs.append(packDescription(*self.current_pack))
        self.startPack()

    def startColumn(self):
        self.current_column=[self.columnFilename(), self.count]

    def endColumn(self):
        self.current_pack[1].append(packColumnDescription(*self.current_column, self.count-1))
        self.column_count+=1
        self.startColumn()

    def getCue(self, width, height):
        # return a string containing:
        # {filename of the pack} {width}:{height}:{drift_x}:{drift_y}
        # print(self.current_pack, self.current_column, self.packs)
        if width > self.largest: self.largest=width

        if self.count > 0:
            if not (self.count % self.pack_size):
                # terminates current pack
                self.endPack()
                # reset drift and largest subtitle image
                self.driftX, self.driftY, self.largest = 0, 0, 0
            elif not (self.count % self.nof_rows):
                # update column drift into current pack,
                # reset drift row and reset largest subtitle
                self.driftX+=self.largest
                self.largest=0
                self.driftY=0
                self.endColumn()

        output=f'{self.packFilename()} {width}:{height}:{self.driftX}:{self.driftY}'
        # updating drift Y and count
        self.driftY+=height
        self.count+=1
        return output

    def subtitleFilename(self, number):
        ''' Returns a string of full subtitle image filename path against its number'''
        return os.path.join(
            self.tmpd.name,
            f'{self.subtitle_prefix}{number:{self.subtitle_format}}.{self.extension}'
        )

    def makeSubtitleImage(self, ds):
        ''' Create subtitle image from a display set
            Parameters
            ----------
            ds : Display Set

            Returns
            -------
            tuple
                (self.GetCue, image_filepath)
        '''
        n=0
        while n < ds['pcs'].nof_obj:
            w,h=(ds['wpo_list'][n].ods.width, ds['wpo_list'][n].ods.height)
            obj_bytes=ds['wpo_list'][n].ods.obj_data
            palette=ds['wpo_list'][n].pds.palette
            subtitle_image=Image.new('P', (w, h), 0)
            subtitle_image.putpalette(palette)
            readObject(subtitle_image, obj_bytes)
            subtitle_image_filename=self.subtitleFilename(ds['pcs'].comp_n//2)
            subtitle_image.save(subtitle_image_filename)
            # save transparency color index
            subtitle_image.info['transparency']=0
            subtitle_image.close()
            n+=1
        return (pack.getCue(w, h), subtitle_image_filename)

def ms2time(milliseconds):
    ''' Convert milliseconds into string time like: HH:MM:SS.mm'''
    time=str(datetime.timedelta(milliseconds=milliseconds)).split('.')
    if len(time) > 1:
        ms=time[1][:-3]
    else:
        ms='000'
    return '{:>02s}:{}:{}.{}'.format(*time[0].split(':'), ms)

def search_nof_subs(read_bytes):
    ''' Try to found last PCS into read_bytes, because PCS contains
        video dimensions and composition number. Number of subtitles
        is compute by composition_number//2.
        PGS starts with 0x5047 or b'PG'
    '''
    n, maxbytes = 0, len(read_bytes)
    while n < maxbytes:
        n += 1
        byte = read_bytes[maxbytes-n:maxbytes-n+1]
        if ( byte == b'G' ):
            # found b'G' or 0x47 byte, so now check
            # if previous byte is 0x50 or b'P'
            n += 1
            byte = read_bytes[maxbytes-n:maxbytes-n+1]
            if ( byte == b'P' ):
                # PGS header found, now check if sub segment type is PCS
                pgs_offset = 13
                pgs = read_bytes[maxbytes-n:maxbytes-n+pgs_offset]
                if ( pgs[10:11] == b'\x16' ):
                    pcs_size = int.from_bytes(pgs[11:13])
                    pcs_bytes = read_bytes[maxbytes-n+pgs_offset:maxbytes-n+pgs_offset+pcs_size]
                    # PCS pts value is not important here (set to 0)
                    pcs = readPCS(pcs_bytes, 0)
                    return f'{pcs.video_width} {pcs.video_height} {(pcs.comp_n//2)+1:d}'
    else:
        return ''

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

def tupleizePalette(palette):
    return [ (palette[(n*3)], palette[(n*3)+1], palette[(n*3)+2]) for n in range(len(palette)//3) ]

def optimizePalette(palette):
    return tuple(sorted(set(tupleizePalette(palette))))

def flattenPalette(palette):
    return [ element for colorTuple in palette for element in colorTuple ]

def stackImages(pil_image1, pil_image2, horizontally=False):
    '''stack pil_image1 and pil_image2 vertically'''
    first, second = pil_image1, pil_image2
    if horizontally:
        width=first.size[0] + second.size[0]
        height=max(first.size[1], second.size[1])
        position=(first.size[0], 0)
    else:
        width=max(first.size[0], second.size[0])
        height=first.size[1] + second.size[1]
        position=(0, first.size[1])

    stack=Image.new('P', (width, height), 0)
    stack.putpalette(mergePalette(pil_image1.getpalette(), pil_image2.getpalette()))
    stack.paste(first)
    stack.paste(second, position)
    pil_image1.close()
    pil_image2.close()
    return stack

def remap(reference, new, colorIndex):
    return new.index(reference[colorIndex])

def mergePalette(first, second):
    first.extend(second)
    return flattenPalette(optimizePalette(first))

def readObject(image, obj_bytes):
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
    palette=image.getpalette()
    palette_tupleized=tupleizePalette(palette)
    optimized_palette=optimizePalette(palette)

    n=0
    while n < len(obj_bytes):
        if (obj_bytes[n]):
            # one byte, isolated colored pixel
            length=1
            color=obj_bytes[n]
            # shift byte position
            n+=1
        else:
            # define default color
            color=0
            # keep witness and go to next byte
            witness=obj_bytes[n+1]
            n+=1
            if witness == 0:
                # new line encountered
                drawer.nextLine()
                n+=1
                # skip drawing line
                continue
            elif witness < 64:
                # two bytes, default color with shorter sequence
                # 000000 00LLLLLL
                length=witness
                n+=1
            elif witness < 128:
                # three bytes, default color with longer sequence
                # 00000000 01LLLLLL LLLLLLLL
                length=((witness-64)<<8)+obj_bytes[n+1]
                n+=2
            elif witness < 192:
                # three bytes, with define color shorter sequence
                # 000000 10LLLLLL CCCCCCCC
                color=obj_bytes[n+1]
                length=witness-128
                n+=2
            else:
                # four bytes, with define color longer sequence
                # 00000000 11LLLLLL LLLLLLLL CCCCCCCC
                color=obj_bytes[n+2]
                length=((witness-192)<<8)+obj_bytes[n+1]
                n+=3
        # remap color against optimized palette
        newColorIndex=remap(palette_tupleized, optimized_palette, color)
        # draw line against color and length values
        drawer.drawLine(newColorIndex, length)
    # write optimized palette into image and add transparency
    # with color at index 0 against color palette
    image.putpalette(flattenPalette(optimized_palette))
    # image.info['transparency']=0

def readWDS(wds_bytes):
    ''' Window Definition Object
    1 byte,  Number of windows: Number of windows defined in this segment
    1 byte,  Window ID: ID of this window
    2 bytes, Window horizontal position: X offset from the top left pixel of the window in the screen
    2 bytes, Window vertical position: Y offset from the top left pixel of the window in the screen
    2 bytes, Window width: Width of the window
    2 bytes, Window height: Height of the window
    '''
    return wds(
        int.from_bytes(wds_bytes[0:1]),
        int.from_bytes(wds_bytes[1:2]),
        int.from_bytes(wds_bytes[2:4]),
        int.from_bytes(wds_bytes[4:6]),
        int.from_bytes(wds_bytes[6:8]),
        int.from_bytes(wds_bytes[8:10])
    )

def readCO(co_bytes):
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
    if ( co_bytes[3:4] == b'\x40' ):
        cropping=(
            int.from_bytes(co_bytes[8:10]),  # obj. crop. pos. x
            int.from_bytes(co_bytes[10:12]),  # obj. crop. pos. y
            int.from_bytes(co_bytes[12:14]),  # obj. crop. width
            int.from_bytes(co_bytes[14:16]),  # obj. crop. height
        )
    return co(
        int.from_bytes(co_bytes[0:2]), # object ID
        co_bytes[3], # window ID
        PCS['objectCroppedFlag'][co_bytes[3:4]], # obj. crop. flag
        int.from_bytes(co_bytes[4:6]), # obj. pos. x
        int.from_bytes(co_bytes[6:8]), # obj. pos. y
        *cropping
    )

def readPCS(pcs_bytes, pts):
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
    n_of_co=pcs_bytes[10]
    composition_obj=(0, 0, 0, 0, 0, 0, 0, 0, 0)
    if n_of_co: composition_obj=readCO(pcs_bytes[11:])
    return pcs(
        int.from_bytes(pcs_bytes[:2]), # video width
        int.from_bytes(pcs_bytes[2:4]), # video height
        pcs_bytes[4], # frame rate
        int.from_bytes(pcs_bytes[5:7]), # composition number
        PCS['compositionState'][pcs_bytes[7:8]], # composition state
        ms2time(pts),
        bool(pcs_bytes[8]), # palette update flag
        pcs_bytes[9], # palette ID
        n_of_co, # number of composition objects
        composition_obj
    )

def readPDS(pds_bytes):
    ''' Palette Definition Segment
    1 byte, ID: ID of the palette
    1 byte, Version Number: Version of this palette within the Epoch
    ------- Following entries can be repeated
    1 byte, Entry ID: Entry number of the palette
    1 byte, Luminance (Y): Luminance (Y value)
    1 byte, Color Difference Red (Cr): Color Difference Red (Cr value)
    1 byte, Color Difference Blue (Cb): Color Difference Blue (Cb value)
    TODO: built-in alpha chanel
    1 byte, Transparency (Alpha): Transparency (Alpha value)
    '''

    # build empty palette YCrCb + alpha (black)
    palette_alpha=[(0, 0, 0, 0)]*256
    # define default rgb colors
    palette=[(redChannel(0, 0), greenChannel(0, 0, 0), blueChannel(0, 0))]*256
    id=pds_bytes[0]
    version=pds_bytes[1]
    pds_bytes=pds_bytes[2:]
    n=0
    while (n < len(pds_bytes)):
        entry=pds_bytes[n]
        # YCrCb to RGB conversion
        y,cr,cb,a=pds_bytes[n+1], pds_bytes[n+2], pds_bytes[n+3], pds_bytes[n+4]
        palette[entry]=(redChannel(y, cr), greenChannel(y, cb, cr), blueChannel(y, cb))
        n+=5
    return pds(id, version, list(itertools.chain.from_iterable(palette)))

def readODS(ods_bytes):
    ''' Object Definition Segment
    '''
    return ods(
        int.from_bytes(ods_bytes[:2]),
        int.from_bytes(ods_bytes[2:3]),
        ods_bytes[3:4],
        int.from_bytes(ods_bytes[4:7]),
        int.from_bytes(ods_bytes[7:9]),
        int.from_bytes(ods_bytes[9:11]),
        ods_bytes[11:]
    )

# check supfile header, search PG 0x50,0x47
if ( supfile.read(2) != b'PG' ):
    print('Wrong header file, this file does not seems to be a sup file, abort.')
    sys.exit(1)
else:
    # try to determine total number of subtitles
    # seek to last byte available
    supfile.seek(-test_maxbytes, 2)
    # save lasts bytes
    read_bytes = supfile.read(test_maxbytes)
    supfile_info = search_nof_subs(read_bytes)
    if supfile_info:
        supfileInfo = namedtuple('SupfileInformation', 'v_width v_height nof_subs')
        supfile_info = supfileInfo(*[ int(e) for e in supfile_info.split() ])
    supfile.seek(0)
    # TODO: what to do when no info ?

# current display set
currentDS={'pcs': None, 'wpo_list': []}
currentWPO={'wds': None, 'pds': None, 'ods': None}
current_webvtt_cue=[]
pack=PackImages(supfile_info.nof_subs, prefix=pack_prefix, rows=rows, columns=columns)
webvtt_path = os.path.join(pack.tmpd.name, webvtt_filename)
webvtt_file=open(webvtt_path, 'w')
webvtt_file.write(f'WEBVTT - {basename}\n')
webvtt_file.write('NOTE\n')
webvtt_file.write('file generated with {0} {1}\n'.format(
    cliParser.prog,
    str(datetime.datetime.now()).split('.')[0]
))
webvtt_file.write('cue content format:\nrelative bitmap pathname width:height:driftX:driftY\n')
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
    pgs_bytes=supfile.read(13)
    magicNumber=pgs_bytes[:2]
    if not magicNumber: break
    pts=int.from_bytes(pgs_bytes[2:6])/90
    dts=int.from_bytes(pgs_bytes[6:10])/90
    segtype=pgs_bytes[10:11]
    size=int.from_bytes(pgs_bytes[11:13])
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
            cue, image_filepath = pack.makeSubtitleImage(currentDS)
            print(f'{image_filepath} saved.', end='\r')
            current_webvtt_cue.append(cue)
            continue
        # end of the current subtitle, so write it
        webvtt_file.write('\n{0}\n{1} --> {2}\n{3}\n'.format(*current_webvtt_cue))
        # reset display set
        currentDS={'pcs': None, 'wpo_list': []}
        if pack.count >= cliArgs.limit: break
    else:
        print(f'Unknown segment type ({segtype}), skipping.')

print(f'{LINE_CLEAR}\r{pack.count} image saved.')
webvtt_file.close()
files=[webvtt_path]
print(f'{webvtt_path} created.')
pack.endPack()

if not pack.count:
    print('Unable to retrieve subtitle from supfile, abort.')
    sys.exit(1)

# image packing
for one_pack in pack.packs:

    for column in one_pack.columns:
        # only one image into this column
        if column.begin == column.end:
            onlyone=Image.open(pack.subtitleFilename(column.end))
            onlyone.save(os.path.join(pack.tmpd.name, column.columnFilename))
            onlyone.close()
            continue

        concat=Image.open(pack.subtitleFilename(column.begin))
        for n in range(column.begin+1, column.end+1):
            second=Image.open(pack.subtitleFilename(n))
            concat=stackImages(concat, second)
            second.close()
        concat.save(os.path.join(pack.tmpd.name, column.columnFilename))
        concat.close()

    # stacked horizontally (final pack)
    pack_image=Image.open(os.path.join(pack.tmpd.name, one_pack.columns[0].columnFilename))
    for n in range(1, len(one_pack.columns)):
        second=Image.open(os.path.join(pack.tmpd.name, one_pack.columns[n].columnFilename))
        pack_image=stackImages(pack_image, second, horizontally=True)
    # TODO: color filter option/parameter ?
    pack_image.info['transparency']=0
    pack_filename=pack.absolutePath(one_pack.packFilename)
    pack_image.save(pack_filename)
    pack_image.close()
    files.append(pack_filename)

# TODO: check if target files already exists
for f in files: os.system('mv {} {}'.format(f, cliArgs.targetDirectory))
