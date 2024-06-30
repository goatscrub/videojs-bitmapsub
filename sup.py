#!/usr/bin/env python3
# -*- coding: UTF8 -*-
import sys
from PIL import Image

image = Image.new('L', (1920, 1080), 255)

supfile=open('tmp/darkwaters.sup', 'rb')
count=0
max_count=4

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
        self.image.putpixel((self.x, self.y), length)
        self.x+=length

    def nextLine(self):
        self.y+=1

def readObject(data):
    print('> read object data')
    data=DataReader(data)
    l=0
    previousAlso=False
    drawer=Drawer(image)
    while True:
        byte=data.consume(1)
        if ( not byte ): break

        # new line encountered
        if ( byte == b'\x00' and previousAlso ):
            previousAlso=False
            drawer.nextLine()
            print('------')
            l+=1
            if ( l > 10 ): break
            continue

        if ( byte == b'\x00' ):
            previousAlso=True
            continue

        if ( previousAlso ):
            bits=bin(int.from_bytes(byte))
            witness=bits[2:4]
            repeat=int('0b'+bits[4:], 2)
            if ( witness == '00' ):
                drawer.draw(0, repeat)
                print('0*{}'.format(repeat))
            elif ( witness == '01'):
                repeat+=int.from_bytes(data.consume(1))
                drawer.draw(0, repeat)
                print('0*{}'.format(repeat))
            elif ( witness == '10'):
                color=int.from_bytes(data.consume(1))
                drawer.draw(color, repeat)
                print('#{}*{}'.format(color, repeat))
            elif ( witness == '11'):
                repeat+=int.from_bytes(data.consume(1))
                color=int.from_bytes(data.consume(1))
                drawer.draw(color, repeat)
                print('#{}*{}'.format(color, repeat))

            continue
        else:
            drawer.draw(int.from_bytes, 1)
            print('#{}'.format(byte))

            # print(bin(int.from_bytes(byte))[2:4])
            # print(bin(int.from_bytes(byte)), int.from_bytes(byte))

    print(l)
    sys.exit(132)

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
    f=open('/tmp/coin.data', 'bw')
    f.write(objectData)
    f.close()
    readObject(objectData)
    print('id:{} version:{} lISF:{} dL:{} w:{} h:{}'.format(id, version, lastInSequenceFlag, dataLength, width, height))

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
    # count+=1
    if ( count > max_count ):
        break

supfile.close()
