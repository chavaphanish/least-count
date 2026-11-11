from pathlib import Path
import subprocess,tempfile
mask=Path(tempfile.gettempdir())/'least-count-yaydu-mask.png'
# Requires Python 3 and ImageMagick 7; not part of the web build.
r=Path(__file__).resolve().parents[1]
def mag(*args):subprocess.run(['magick',*map(str,args)],check=True)
# Ignore only the external image frame; symbol pixels and its alignment are untouched.
mag(r/'assets/branding/yaydu-original.png','-colorspace','Gray','-threshold','50%','-fill','black','-draw','rectangle 0,0 291,8 rectangle 0,0 5,339 rectangle 286,0 291,339 rectangle 0,337 291,339','-background','black','-gravity','center','-extent','340x340','-resize','1024x1024',mask)
mag('-size','1024x1024','xc:#e9cd91',mask,'-alpha','off','-compose','CopyOpacity','-composite',r/'public/branding/yaydu-gold.png')
def icon(path,size,fraction=.68,transparent=False):
 path.parent.mkdir(parents=True,exist_ok=True)
 mag(r/'public/branding/yaydu-gold.png','-resize',f'{round(size*fraction)}x{round(size*fraction)}','-background','none' if transparent else '#0c2e26','-gravity','center','-extent',f'{size}x{size}',path)
for size in [192,512]:icon(r/f'public/icons/yaydu-{size}.png',size)
icon(r/'public/icons/yaydu-apple-touch-icon.png',180)
icon(r/'public/favicon.png',32,.95)
for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
 for name in ['ic_launcher','ic_launcher_round']:icon(r/f'android/app/src/main/res/mipmap-{density}/{name}.png',size)
 # Android's 108dp foreground: keep the complete symbol inside its 66dp safe circle.
 icon(r/f'android/app/src/main/res/mipmap-{density}/ic_launcher_foreground.png',round(size*108/48),.55,True)
icon(r/'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',1024)
# Keep old public icon URLs valid for already installed PWAs; all now use new art.
for old,new in [('icon-192.png','yaydu-192.png'),('icon-512.png','yaydu-512.png'),('apple-touch-icon.png','yaydu-apple-touch-icon.png')]:
 (r/'public/icons'/old).write_bytes((r/'public/icons'/new).read_bytes())
for p in list((r/'android/app/src/main/res').glob('drawable*/splash.png'))+list((r/'ios/App/App/Assets.xcassets/Splash.imageset').glob('*.png')):
 w,h=map(int,subprocess.check_output(['magick','identify','-format','%w %h',str(p)]).split())
 size=round(min(w,h)*.45)
 mag(r/'public/branding/yaydu-gold.png','-resize',f'{size}x{size}','-background','#0c2e26','-gravity','center','-extent',f'{w}x{h}',p)
