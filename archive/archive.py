#!/usr/bin/env python3

c_yellow='\033[0;33m'
c_white='\033[1;37m'
c_green='\033[0;32m'
c_cyan='\033[0;36m'
c_red='\033[0;31m'
c_blue='\033[0;34m'
c_term_reset='\033[0m'
LINE_CLEAR='\x1b[2K'

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
