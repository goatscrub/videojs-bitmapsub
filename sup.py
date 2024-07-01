#!/usr/bin/env python3
# -*- coding: UTF8 -*-
import sys, os
from PIL import Image, ImageDraw, ImageShow

supfile=open('tmp/darkwaters.sup', 'rb')
count=0
max_count=64

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

        if ( length > 1):
            # drawing line
            draw=ImageDraw.Draw(self.image)
            draw.line((self.x, self.x+length), fill=None, width=1, joint=None)
        else:
            # print("here")
            for n in range(length):
                self.image.putpixel((self.x+n, self.y), color)
        self.x+=length

    def nextLine(self):
        self.x=0
        self.y+=1

def readObject(image, data):
    l,max_line,fwidth=0, 8, 25
    print('> read object data')
    print(data[:32], '\n')
    print('{:>3} {:10} {:2s} {:3s} {:1s}'.format('ccc', 'bits', 'wt', 'rp', 'o'))
    print('{:->25}'.format(''))
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
        color=(0, 0)
        octets=1

        if ( previousAlso ):
            octets+=1
            if ( byte == b'\x00' ):
                # new line encountered
                drawer.nextLine()
                # print('{:->25}'.format(''))
                l+=1
                # if ( l > max_line ): break
            elif ( witness == '00' ):
                # two bytes, default color (transparent with shorter sequence)
                drawer.draw(color, repeat)
            elif ( witness == '01'):
                # three bytes, default color (transparent with longer sequence)
                repeat+=int.from_bytes(data.consume(1))
                octets+=1
                drawer.draw(color, repeat)
            elif ( witness == '10'):
                # three bytes, with define color shorter sequence
                color=(int.from_bytes(data.consume(1)), 255)
                octets+=1
                drawer.draw(color, repeat)
            elif ( witness == '11'):
                # four bytes, with define color longer sequence
                repeat+=int.from_bytes(data.consume(1))
                color=(int.from_bytes(data.consume(1)), 255)
                octets+=2
                drawer.draw(color, repeat)
            # reset marker
            previousAlso=False

        # marker encountered
        elif ( byte == b'\x00' ):
            previousAlso=True
            color='×××'
            repeat='×'
            witness='××'

        else:
            # one byte, isolated colored pixel
            color=(int.from_bytes(byte), 255)
            witness='××'
            repeat=1
            drawer.draw(color, repeat)

        print(format(f'{color[0]:>3},{color[1]:>3} {bits:>10} {witness:>2} {repeat:<3} {octets:>1}'))
    print(l)

def readEnd(data):
    print('> end')
    data=DataReader(data)

def readODS(data):
    print('> object')
    data=DataReader(data)
    id=int.from_bytes(data.consume(2))
    version=int.from_bytes(data.consume(1))
    lastInSequenceFlag=data.consume(1)
    dataLength=int.from_bytes(data.consume(3))
    width=int.from_bytes(data.consume(2))
    height=int.from_bytes(data.consume(2))
    objectData=data.consume(dataLength)
    imageFilename='/tmp/image-{:04d}.png'.format(id)
    image = Image.new('LA', (width, height), (255, 255))
    readObject(image, objectData)
    image.save(imageFilename)
    image.close()
    os.system('/usr/bin/sxiv {}'.format(imageFilename))
    # sys.exit(132)
    # print('id:{} version:{} lISF:{} dL:{} w:{} h:{}'.format(id, version, lastInSequenceFlag, dataLength, width, height))

def readPDS(data):
    print('> palette')
    data=DataReader(data)
    paletteID=int.from_bytes(data.consume(1))
    paletteVersionNumber=int.from_bytes(data.consume(1))
    c=0
    while True:
        paletteEntryID=int.from_bytes(data.consume(1))
        if ( not paletteEntryID ): break
        luminance=int.from_bytes(data.consume(1))
        colorDifferenceRed=int.from_bytes(data.consume(1))
        colorDifferenceBlue=int.from_bytes(data.consume(1))
        alpha=int.from_bytes(data.consume(1))
        c+=1
        # print('pID:{} pVN:{} pEID:{} l:{} cDR:{} cDB:{} a:{} '.format(paletteID, paletteVersionNumber, paletteEntryID, luminance, colorDifferenceRed, colorDifferenceBlue, alpha))
    print('number of palette: {}'.format(c))

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

def readSegment(n):
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
    # print('{}({})'.format(segtype, str(int.from_bytes(segsize))))

    if ( segtype == b'\x14' ):
        segtype='PDS'
        readPDS(subdata)
    elif ( segtype == b'\x15' ):
        segtype='ODS'
        readODS(subdata)
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
    #print(dts)
    #print(str(segsize))
    return True

while readSegment(count):
    print()
    count+=1
    if ( count > max_count ): break

supfile.close()
