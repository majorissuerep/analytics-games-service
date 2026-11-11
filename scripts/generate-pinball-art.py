#!/usr/bin/env python3
"""Deterministic original Aster aerospace enamel artwork; Python 3, Pillow, numpy.
Geometry, bitmap bounds, index-zero masks and every non-art DAT record are preserved.
"""
import argparse, hashlib, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
DEFAULT=ROOT/'public/vendor/space-cadet'

def records(data):
    p=183+struct.unpack_from('<H',data,181)[0]; groups=[]
    for _ in range(struct.unpack_from('<H',data,175)[0]):
        n=data[p]; p+=1; entries=[]
        for _ in range(n):
            t=data[p];p+=1
            if t in (0,2): size=2
            else: size=struct.unpack_from('<I',data,p)[0];p+=4
            entries.append((t,p,size));p+=size
        groups.append(entries)
    assert p==len(data)
    return groups

def generate(source):
    data=bytearray(source); groups=records(data)
    po,ps=next((o,s) for es in groups for t,o,s in es if t==5)
    old=np.array([list(data[po+i*4:po+i*4+3][::-1]) for i in range(256)],dtype=float)
    # Explicit small material ramps keep every component within the same finish system.
    ramps=[((25,29,35),(135,143,149),64),((117,61,78),(232,156,172),48),((166,154,138),(253,247,231),64),((92,99,108),(255,255,250),64)]
    palette=[(0,0,0)]
    for a,b,n in ramps:
        palette += [tuple(round(a[c]+(b[c]-a[c])*k/(n-1)) for c in range(3)) for k in range(n)]
    palette += [(242,226,209)]*(256-len(palette));palette=palette[:256]
    pim=Image.new('P',(1,1));pim.putpalette([v for rgb in palette for v in rgb])
    previews=[]; count=0
    for g,es in enumerate(groups):
        for t,o,size in es:
            if t!=1: continue
            r,w,h,x,y,length,flags=struct.unpack_from('<BhhhhIB',data,o)
            assert not flags&4, 'Spliced sprites require a decoder'
            stride=length//h;assert stride*h==length and stride>=w
            raw=np.frombuffer(source[o+14:o+14+length],dtype=np.uint8).reshape(h,stride).copy()
            idx=raw[::-1,:w].copy(); mask=idx!=0;rgb=old[idx]
            lum=rgb@np.array([.2126,.7152,.0722]); warm=(rgb[:,:,0]>rgb[:,:,2]*1.25)&(rgb[:,:,0]>30)
            v=np.clip(lum/150,0,1)[:,:,None]
            base=np.array([28,32,39])+v*np.array([180,182,177]);base[warm]=np.array([111,51,70])+v[warm]*np.array([123,113,115])
            # All physical bodies get neutral machined finish, warm enamel accents.
            im=Image.fromarray(np.uint8(np.clip(base,0,255))).filter(ImageFilter.GaussianBlur(.45))
            if g==107:
                yy,xx=np.mgrid[:h,:w]
                floor=(rgb[:,:,2]-rgb[:,:,0]>26)&(rgb[:,:,0]<43)&mask
                floor=np.array(Image.fromarray(np.uint8(floor)*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
                floor &= mask
                base=np.array(im,dtype=float)
                ivory=np.zeros((h,w,3));ivory[:]=[235,226,208]
                ivory+=((xx/w)*7-(yy/h)*15)[:,:,None]
                base[floor]=ivory[floor];im=Image.fromarray(np.uint8(np.clip(base,0,255)))
                art=Image.new('RGB',(w,h),(0,0,0));d=ImageDraw.Draw(art)
                # Architectural flight paths, printed in enamel, deliberately sparse.
                for shift in [0,7]:
                    d.line([(178+shift,82),(219+shift,132),(190+shift,205),(190+shift,349),(166+shift,405)],fill=(183,108,126),width=2)
                d.line([(104,111),(164,181),(164,350),(131,401)],fill=(164,156,143),width=1)
                for cy in [182,215,329,356]:
                    d.line([(150,cy),(204,cy)],fill=(186,174,155),width=1)
                # Original aerospace mission seal replaces the neon reactor illustration.
                d.ellipse((137,222,229,314),fill=(44,48,55),outline=(244,235,216),width=2)
                d.ellipse((144,229,222,307),outline=(180,110,129),width=2)
                d.ellipse((150,235,216,301),outline=(194,190,176),width=1)
                d.polygon([(183,242),(204,283),(184,276),(163,283)],fill=(239,229,208))
                d.polygon([(183,250),(184,276),(172,279)],fill=(180,108,125))
                d.line([(158,290),(208,290)],fill=(181,111,129),width=2)
                d.text((167,294),'A S T E R',fill=(240,230,211),font=ImageFont.load_default(size=7))
                d.text((134,365),'FLIGHT / 01',fill=(105,72,79),font=ImageFont.load_default(size=10))
                d.text((137,378),'ORBITAL DIVISION',fill=(100,101,98),font=ImageFont.load_default(size=7))
                arr=np.array(im);aa=np.array(art);paint=(aa.sum(axis=2)>0)&floor
                # Seal sits on the existing central fixture footprint, no gameplay geometry changes.
                seal=((xx-183)**2+(yy-268)**2<46**2)&mask
                arr[paint|seal]=aa[paint|seal];im=Image.fromarray(arr)
            if 355<=g<=370:
                # Both flippers, all eight angle states: rose enamel, chrome rim.
                yy,xx=np.mgrid[:h,:w]
                shade=np.clip(lum/130,0,1)
                enamel=np.stack([145+83*shade,66+81*shade,91+83*shade],axis=2)
                inner=np.array(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.MinFilter(3)))>0
                rim=mask&~inner
                # Mechanical silhouette stays exact; a bright lip separates the bat.
                metal=np.stack([173+70*shade,177+67*shade,178+62*shade],axis=2)
                enamel[rim]=metal[rim]
                enamel[inner&(lum>130)]=[250,241,225]
                im=Image.fromarray(np.uint8(enamel))
            if 108<=g<=114:
                yy,xx=np.mgrid[:h,:w];z=np.clip(1-((xx-(w-1)/2)/(w/2))**2-((yy-(h-1)/2)/(h/2))**2,0,1)**.5
                light=np.clip(.25+.65*z-.2*xx/w-.15*yy/h,0,1)
                ar=np.stack([70+185*light,76+179*light,84+169*light],axis=2).astype('uint8')
                ar[(xx-w*.3)**2+(yy-h*.25)**2<(w*.17)**2]=[255,255,248];im=Image.fromarray(ar)
            indexed=np.array(im.quantize(palette=pim,dither=Image.Dither.NONE)); indexed[mask&(indexed==0)]=1;indexed[~mask]=0
            assert np.array_equal(indexed==0,idx==0)
            raw[::-1,:w]=indexed;data[o+14:o+14+length]=raw.tobytes();count+=1
            if g in (2,107,355,358,363,366):
                preview=Image.fromarray(indexed,'P');preview.putpalette(pim.getpalette());previews.append((g,preview.convert('RGB')))
    for i,(red,green,blue) in enumerate(palette):data[po+i*4:po+i*4+4]=bytes((blue,green,red,0))
    # Bit-for-bit validation of all non-art fields, including depth/collision/physics.
    for es in groups:
        for t,o,s in es:
            if t not in (1,5):assert data[o:o+s]==source[o:o+s]
            if t==1:assert data[o:o+14]==source[o:o+14]
    return bytes(data),previews,count

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,default=DEFAULT/'art/OPEN-CADET-CC0.DAT');ap.add_argument('--output',type=Path,default=DEFAULT/'PINBALL.DAT');ap.add_argument('--check',action='store_true');args=ap.parse_args()
    result,previews,n=generate(args.source.read_bytes())
    if args.check:assert args.output.read_bytes()==result,'Output differs; regenerate assets'
    else:
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_bytes(result)
        for g,im in previews:im.save(DEFAULT/f'art/aster-{g}.png')
    print(f'{n} bitmaps; {len(result)} bytes; SHA256 {hashlib.sha256(result).hexdigest()}')
if __name__=='__main__':main()
