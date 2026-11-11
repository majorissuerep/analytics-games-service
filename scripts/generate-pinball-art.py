#!/usr/bin/env python3
"""Deterministic original Aster aerospace enamel artwork; Python 3, Pillow, numpy.
Geometry, bitmap bounds, index-zero masks and every non-art DAT record are preserved.
"""
import argparse, hashlib, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
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
    ramps=[((9,18,30),(49,80,106),64),((108,36,72),(249,180,201),48),((47,66,82),(209,225,231),64),((99,111,123),(255,255,250),64),((32,100,123),(157,233,239),15)]
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
            yy,xx=np.mgrid[:h,:w]
            # New physical material, derived only from the exact fixture silhouette.
            # No inherited photographic/textured luminance is used for sprites.
            body=Image.fromarray(np.uint8(mask)*255)
            inner=np.array(body.filter(ImageFilter.MinFilter(3)))>0
            inner2=np.array(body.filter(ImageFilter.MinFilter(5)))>0
            tone=np.clip(.82-.40*yy/max(1,h)-.15*xx/max(1,w),0,1)[:,:,None]
            base=np.array([29,51,71])+tone*np.array([23,31,36])
            base[mask&~inner]=[69,101,125]
            base[inner&~inner2]=[50,74,93]
            im=Image.fromarray(np.uint8(base))
            if g==107:
                # A new supersampled architectural drawing uses the factual rail
                # positions as a guide, not inherited texture or palette pixels.
                k=4
                table=Image.new('RGB',(w*k,h*k),(17,31,44));d=ImageDraw.Draw(table)
                def line(points,fill,width=1):
                    d.line([(int(a*k),int(b*k)) for a,b in points],fill=fill,width=max(1,int(width*k)),joint='curve')
                def poly(points,fill):d.polygon([(int(a*k),int(b*k)) for a,b in points],fill=fill)
                def ellipse(box,fill,outline=None,width=1):d.ellipse(tuple(int(v*k) for v in box),fill=fill,outline=outline,width=int(width*k))
                def curve(points,steps=45):
                    out=[]
                    for n in range(steps+1):
                        t=n/steps;u=1-t
                        out.append(tuple(u*u*u*points[0][j]+3*u*u*t*points[1][j]+3*u*t*t*points[2][j]+t*t*t*points[3][j] for j in range(2)))
                    return out
                def rail(points,width=4):
                    line([(a,b+2) for a,b in points],(7,17,27),width+3)
                    line(points,(69,96,117),width)
                    line([(a-.3,b-.5) for a,b in points],(174,196,210),max(.7,width*.25))
                # Opaque enamel floor, broad quiet fixed light; it has no artwork
                # suggesting invented collision geometry.
                poly([(76,5),(286,5),(359,416),(5,416)],(22,43,63))
                for row in range(8,415):
                    left=76-(row-5)*71/411;right=286+(row-5)*73/411
                    light=max(0,1-abs(row-205)/220)
                    line([(left+2,row),(right-2,row)],(int(20+light*5),int(40+light*7),int(60+light*9)),1.1)
                rail([(77,6),(286,6),(358,415),(6,415),(77,6)],5)
                # Shooter lane remains fully visible through the native plunger.
                rail([(289,100),(326,354),(332,411)],4)
                rail([(316,236),(338,397)],3)
                # Upper orbit and return lanes.
                rail(curve([(105,30),(162,0),(244,14),(282,80)]),5)
                rail(curve([(108,39),(163,10),(234,28),(268,84)]),3)
                rail(curve([(282,79),(299,108),(275,142),(267,160)]),4)
                rail(curve([(106,51),(83,65),(66,111),(82,133)]),4)
                rail(curve([(114,53),(96,76),(86,102),(99,119)]),3)
                # Raised launch ramp: two deliberate steel lips, stable opaque bed.
                ramp=curve([(82,126),(113,123),(144,151),(148,171)])
                line(ramp,(8,19,31),19);line(ramp,(49,77,100),14)
                rail([(a-5,b) for a,b in ramp],2);rail([(a+5,b) for a,b in ramp],2)
                rail(curve([(148,171),(137,178),(123,178),(116,176)]),3)
                rail(curve([(79,139),(65,153),(60,181),(60,204)]),4)
                rail(curve([(72,140),(89,145),(94,161),(84,173)]),3)
                # Middle right return channel and lower inlanes.
                rail([(286,175),(265,185),(265,218),(286,229)],5)
                rail([(282,180),(273,189),(273,214),(291,223)],2)
                rail([(52,249),(29,361)],4);rail([(63,250),(44,353)],3)
                rail([(289,255),(307,353)],4)
                rail([(282,265),(291,349)],3)
                rail([(31,358),(88,390),(90,412)],6)
                rail([(44,350),(99,380)],4)
                rail([(304,356),(257,390),(255,412)],6)
                rail([(289,350),(248,379)],4)
                # Existing physical slingshot footprints, drawn with a smooth
                # rubber body and one steel rim rather than engraved noise.
                for points in [[(102,316),(126,365),(88,350),(102,316)],[(261,316),(239,365),(278,350),(261,316)]]:
                    poly(points,(48,73,93));rail(points,4)
                # Existing holes are recessed, never highlighted as ball caps.
                for box in [(94,30,112,47),(104,77,120,91),(153,83,169,96),(190,77,207,90),(168,101,186,115),(48,201,63,217),(47,225,62,239)]:
                    ellipse(tuple(v+1 for v in box),(4,14,24));ellipse(box,(5,16,27),(100,133,154),1.5)
                # Native upper targets retain their real lane positions.
                for tx in [146,155,164,173,182]:
                    poly([(tx,45),(tx+4,45),(tx+3,61),(tx+1,61)],(10,25,38))
                    line([(tx,45),(tx+4,45),(tx+3,61)],(142,171,188),1)
                # Real target banks use measured native component bounds. Quiet
                # steel pedestals and clear enamel faces make them playable cues,
                # not ghost text. Sprite state remains above the fixed pedestal.
                for tg in [432,433,434,435,436,437,438,439,440,442,444,446,448,450,452,454,456,458,460,462,464,466]:
                    to=next(to for tt,to,ts in groups[tg] if tt==1)
                    tr,tw,th,tx,ty,tl,tf=struct.unpack_from('<BhhhhIB',source,to)
                    tx-=x;ty-=y
                    box=(int(tx*k),int(ty*k),int((tx+tw)*k),int((ty+th)*k))
                    d.rounded_rectangle(tuple(v+int(k) for v in box),radius=k,fill=(7,20,32))
                    d.rounded_rectangle(box,radius=k,fill=(67,104,128),outline=(145,180,199),width=2)
                    line([(tx+1,ty+1),(tx+tw-1,ty+1)],(137,213,221),1)
                # Rollover switches are real flat lane inserts, not stray gray
                # glyphs. Their exact measured positions get recessed lens beds.
                for rg in range(520,538):
                    bitmaps=[ro for rt,ro,rs in groups[rg] if rt==1]
                    if not bitmaps:continue
                    rr,rw,rh,rx,ry,rl,rf=struct.unpack_from('<BhhhhIB',source,bitmaps[0])
                    rx-=x;ry-=y
                    box=tuple(int(v*k) for v in (rx,ry,rx+rw,ry+rh))
                    d.rounded_rectangle(box,radius=2*k,fill=(37,66,88),outline=(111,151,174),width=2)
                    line([(rx+rw*.3,ry+2),(rx+rw*.3,ry+rh-2)],(76,119,144),1)
                # Fixed backing beneath the native bumper masks represents the
                # same seven measured physical caps. This keeps transparent texture
                # holes from reading as pockmarks; native animation stays above it.
                for bg in [372,380,388,396,405,413,421]:
                    bo=next(bo for bt,bo,bs in groups[bg] if bt==1)
                    br,bw,bh,bx,by,bl,bf=struct.unpack_from('<BhhhhIB',source,bo)
                    cx=bx-x+bw*.48;cy=by-y+bh*.43
                    rx=bw*.40;ry=bh*.37
                    ellipse((cx-rx-1,cy-ry,cx+rx+1,cy+ry+2),(10,24,36))
                    ellipse((cx-rx,cy-ry,cx+rx,cy+ry),(75,137,162),(132,185,201),.8)
                im=table.resize((w,h),Image.Resampling.LANCZOS)
                table_backing=np.array(im)
                for bg in [372,380,388,396,405,413,421]:
                    bo=next(bo for bt,bo,bs in groups[bg] if bt==1)
                    br,bw,bh,bx,by,bl,bf=struct.unpack_from('<BhhhhIB',source,bo)
                    qy,qx=np.mgrid[:bh,:bw];px=(qx-bw*.48)/(bw*.46);py=(qy-bh*.43)/(bh*.44)
                    dome=np.clip(1-px*px-py*py,0,1)**.6
                    cap=np.array([65,125,147])+dome[:,:,None]*np.array([41,79,78])
                    cap[(px+.3)**2+(py+.35)**2<.065]=[170,231,235]
                    cut=px*px+py*py<.82
                    ox=bx-x;oy=by-y
                    region=table_backing[oy:oy+bh,ox:ox+bw]
                    region[cut]=np.uint8(cap)[cut]
                im=Image.fromarray(table_backing)
                previews.append(('backing',im.copy()))
            if 355<=g<=370:
                # Both flippers, all eight angle states: rose enamel, chrome rim.
                yy,xx=np.mgrid[:h,:w]
                shade=np.clip(.90-.4*yy/max(1,h),0,1)
                enamel=np.stack([145+83*shade,66+81*shade,91+83*shade],axis=2)
                inner=np.array(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.MinFilter(3)))>0
                rim=mask&~inner
                # Mechanical silhouette stays exact; a bright lip separates the bat.
                metal=np.stack([173+70*shade,177+67*shade,178+62*shade],axis=2)
                enamel[rim]=metal[rim]
                enamel[inner&(yy<h*.2)]=[249,192,209]
                im=Image.fromarray(np.uint8(enamel))
            if 115<=g<=259:
                # Off inserts are recessed dark enamel; bright native states are
                # unmistakably cyan. Do not outline every transparent mask pixel.
                active=lum[mask].mean()>65 if mask.any() else False
                if active:
                    color=np.array([53,158,180]);top=np.array([93,65,57])
                else:
                    color=np.array([20,42,62]);top=np.array([6,10,13])
                ramp=np.clip(1-yy/max(1,h),0,1)[:,:,None]
                im=Image.fromarray(np.uint8(color+ramp*top))
                if not active:
                    # Native off lamps contain scattered icon pixels. Match their
                    # factual backing exactly; only an actual lit state is cyan.
                    sx=x-137;sy=y-2
                    if sx>=0 and sy>=0 and sx+w<=365 and sy+h<=470:
                        im=Image.fromarray(table_backing[sy:sy+h,sx:sx+w].copy())
            if 432<=g<=468:
                face=np.clip(1-yy/max(h,1),0,1)[:,:,None]
                im=Image.fromarray(np.uint8(np.array([65,105,131])+face*np.array([63,79,78])))
            if 520<=g<=537:
                lens=np.clip(1-yy/max(h,1),0,1)[:,:,None]
                im=Image.fromarray(np.uint8(np.array([38,68,91])+lens*np.array([32,43,45])))
            if 372<=g<=428:
                # Native bumper outlines with a clean enamel dome and metal lip.
                yy,xx=np.mgrid[:h,:w]
                px=(xx-w*.48)/(max(w,1)*.46);py=(yy-h*.43)/(max(h,1)*.44)
                dome=np.clip(1-px*px-py*py,0,1)**.6
                ar=np.array([65,125,147])+dome[:,:,None]*np.array([41,79,78])
                rim=mask&~(np.array(body.filter(ImageFilter.MinFilter(3)))>0)
                ar[rim]=[81,143,162]
                shine=(px+.3)**2+(py+.35)**2<.065
                ar[shine&inner]=[170,231,235]
                im=Image.fromarray(np.uint8(np.clip(ar,0,255)))
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
    backing=next(im for g,im in previews if g=='backing').convert('RGBA')
    backing_bytes=np.array(backing)[:,:,[2,1,0,3]].tobytes()
    if args.check:
        assert args.output.read_bytes()==result,'Output differs; regenerate assets'
        assert (DEFAULT/'ASTER-BACKING.BGRA').read_bytes()==backing_bytes,'Backing differs; regenerate assets'
    else:
        (DEFAULT/'ASTER-BACKING.BGRA').write_bytes(backing_bytes)
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_bytes(result)
        for g,im in previews:im.save(DEFAULT/f'art/aster-{g}.png')
    print(f'{n} bitmaps; {len(result)} bytes; SHA256 {hashlib.sha256(result).hexdigest()}')
if __name__=='__main__':main()
