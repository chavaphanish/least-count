"""Original procedural Foley/chime/applause. Python 3 + ffmpeg, no downloaded audio."""
from pathlib import Path
import math, random, wave, struct, subprocess, tempfile
r=Path(__file__).resolve().parents[1]/'public/audio';r.mkdir(exist_ok=True)
sr=22050
random.seed(73017)
def noise(n):
 out=[];low=0
 for _ in range(n):
  x=random.uniform(-1,1);low=.65*low+.35*x;out.append(low)
 return out
def write(name,data):
 peak=max(map(abs,data)) or 1; data=[x/peak*.65 for x in data]
 with tempfile.NamedTemporaryFile(suffix='.wav') as f:
  with wave.open(f.name,'w') as w:
   w.setparams((1,2,sr,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(x*32767)) for x in data))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f.name,'-codec:a','libmp3lame','-b:a','64k','-map_metadata','-1',str(r/(name+'.mp3'))],check=True)
def card(name,duration,pitch):
 n=int(sr*duration);a=noise(n)
 for i in range(n):
  t=i/sr;env=math.sin(math.pi*i/n)**1.5
  a[i]=a[i]*env*.75+math.sin(2*math.pi*pitch*t)*math.exp(-t*45)*.08
 write(name,a)
for name,d,p in [('card_deal',.13,180),('card_draw',.22,140),('card_pickup',.18,165),('card_drop',.15,95),('card_swoosh',.12,190)]:card(name,d,p)
write('turn_bell',[sum(math.sin(2*math.pi*f*i/sr)*a*math.exp(-i/sr*k) for f,a,k in [(880,.7,5),(1760,.2,8),(2640,.08,12)])*min(1,i/(sr*.008)) for i in range(int(sr*.8))])
a=noise(sr)
write('timer_tick',[a[i]*math.exp(-i/sr*95)*min(1,i/20) if i<sr*.12 else 0 for i in range(sr)])
# A small crowd: irregular overlapping palm transients and short room reflections.
n=sr*5;applause=[0.0]*n
for _ in range(155):
 start=random.randrange(n-int(.2*sr));length=int(sr*random.uniform(.035,.1));clap=noise(length);gain=random.uniform(.25,.8)
 for i,v in enumerate(clap):
  env=math.exp(-i/length*6)*min(1,i/12)
  for delay,amount in [(0,1),(int(sr*.032),.2),(int(sr*.071),.08)]:
   j=start+i+delay
   if j<n:applause[j]+=v*env*gain*amount
for name,duration in [('round_applause',3),('game_applause',5)]:
 data=applause[:sr*duration]
 data=[x*min(1,i/(sr*.12),(len(data)-i)/(sr*.4)) for i,x in enumerate(data)]
 write(name,data)
