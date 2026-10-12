"""Rebuild design-only token data and exhaustive WCAG contrast evidence. No dependencies."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
PALETTES = {
    'Midnight': ['#131321','#1B1B2D','#222238','#2B2B43','#77758D','#FFF7F3','#D4CDDE','#BAB2C8','#F0A9BD','#261620','#C4B5FD'],
    'Noir': ['#000000','#0C0C0C','#151515','#222222','#777777','#FFFFFF','#D4D4D4','#B5B5B5','#FFAAAA','#260D0D','#FFC0C0'],
    'Rose': ['#FFF5F1','#FFFFFF','#F9EAE6','#F1DCD7','#8E6669','#342029','#60434D','#74535D','#8A294B','#FFFFFF','#744A77'],
    'Sunset': ['#21131F','#2C1C29','#352334','#402D3F','#9C788D','#FFF6EF','#E4C9D8','#C9AFC1','#FFB29D','#30171C','#F7CB81'],
    'Ocean': ['#071E23','#102A30','#18343B','#213F46','#69979F','#F0FDFA','#C1DEDE','#A8C7CC','#91DED4','#102B2A','#A5CAFF'],
    'Lavender': ['#F8F4FF','#FFFFFF','#EEE7FA','#E4DBF3','#867397','#30223F','#58476D','#6B597E','#67429A','#FFFFFF','#8A356F'],
    'Forest': ['#111B14','#1B281E','#253328','#303F32','#809881','#F7F9EF','#D3DFCF','#B5C8B1','#BDD3AA','#1C2B16','#E7CC8B'],
}
KEYS = ['bg','bgElevated','surface','surfaceAlt','border','textPrimary','textSecondary','textMuted','primary','primaryContrast','accent']
themes = {}
for name, values in PALETTES.items():
    t = dict(zip(KEYS, values))
    light = name in ['Rose','Lavender']
    t.update(success='#275E41' if light else '#B1DDBF', warning='#77500A' if light else '#F3D08C', danger='#9A233C' if light else '#FFB4BE',
             bubbleMineStart=t['primary'], bubbleMineEnd=t['primary'], bubbleMineText=t['primaryContrast'],
             bubbleTheirs=t['surfaceAlt'], bubbleTheirsText=t['textPrimary'],
             tickSent='#E8CAD8' if light else '#503C49', tickSeen='#FFFFFF' if light else '#302739',
             overlay='#000000B8', shadowColor='#000000')
    # Restrained tonal gradients; same hue, different luminance. Text is verified over the entire interpolation.
    t['bubbleMineEnd'] = {'Midnight':'#DDA1C7','Noir':'#F29B9B','Rose':'#723047','Sunset':'#ECA2A6','Ocean':'#A5CFD2','Lavender':'#59398B','Forest':'#C9CAA0'}[name]
    themes[name] = t
themes = {'Auto': dict(themes['Rose']), **themes}

type_scale = []
for name, size, line, weight, tracking in [
    ('display/XL',48,56,600,-1),('display/L',40,48,600,-0.8),('display/M',32,40,600,-0.5),
    ('title/L',26,34,700,-0.4),('title/M',22,30,600,-0.2),('title/S',18,26,600,0),
    ('body/L',18,28,400,0),('body/M',16,24,400,0),('body/S',14,22,400,0),
    ('label',14,20,600,0.2),('caption',12,18,500,0.2)]:
    type_scale.append(dict(name=name,font='Fraunces' if name.startswith('display') else 'Plus Jakarta Sans',size=size,lineHeight=line,weight=weight,letterSpacing=tracking))
data = dict(themes=themes, auto=dict(day='Rose',night='Midnight',dayStart='07:00',nightStart='19:00',timezone='device local'),
            spacing=[4,8,12,16,20,24,32,40,56],radii=[8,12,16,20,28,999],typeScale=type_scale,
            motion=dict(instant=90,fast=160,base=240,slow=400,hero=600,stagger=40,pressScale=0.96,
                        springs=dict(gentle=dict(damping=24,stiffness=180,mass=1),snappy=dict(damping=26,stiffness=320,mass=0.8),bouncy=dict(damping=14,stiffness=220,mass=0.9)),
                        easings=dict(standard=[0.2,0,0,1],enter=[0,0,0.2,1],exit=[0.4,0,1,1],linear=[0,0,1,1])),
            elevations=[dict(level=i,x=0,y=y,blur=b,spread=0,opacity=o,androidDp=dp) for i,y,b,o,dp in [(0,0,0,0,0),(1,2,8,.12,1),(2,4,16,.16,3),(3,8,24,.20,6),(4,16,40,.24,12)]])

def rgb(value):
    return [int(value[i:i+2],16)/255 for i in (1,3,5)]
def lum(c):
    r,g,b = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    return .2126*r+.7152*g+.0722*b
def contrast(a,b):
    a,b=sorted([lum(a),lum(b)])
    return (b+.05)/(a+.05)
checks=[]
for name,t in themes.items():
    for fg in ['textPrimary','textSecondary','textMuted','primary','accent','success','warning','danger']:
        for bg in ['bg','bgElevated','surface','surfaceAlt']:
            checks.append(dict(theme=name,foreground=fg,background=bg,ratio=contrast(rgb(t[fg]),rgb(t[bg]))))
    checks.append(dict(theme=name,foreground='primaryContrast',background='primary',ratio=contrast(rgb(t['primaryContrast']),rgb(t['primary']))))
    checks.append(dict(theme=name,foreground='bubbleTheirsText',background='bubbleTheirs',ratio=contrast(rgb(t['bubbleTheirsText']),rgb(t['bubbleTheirs']))))
    a,b=rgb(t['bubbleMineStart']),rgb(t['bubbleMineEnd'])
    for fg in ['bubbleMineText','tickSent','tickSeen']:
        ratios=[contrast(rgb(t[fg]),[x+(y-x)*i/1000 for x,y in zip(a,b)]) for i in range(1001)]
        checks.append(dict(theme=name,foreground=fg,background='bubbleMine gradient (1001 samples)',ratio=min(ratios)))
failures=[c for c in checks if c['ratio']<4.5]
ROOT.joinpath('tokens.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
report = '# Contrast verification\n\nWCAG sRGB relative luminance, (L1 + 0.05)/(L2 + 0.05). All text, including small timestamps, must reach 4.5:1. Opaque text only; no opacity reduction.\n\n'
report += 'Both Auto resolutions are covered: day duplicates Rose; night resolves Midnight. Gradients are sRGB with 1,001 samples including both endpoints; this is numerical sampling, not a mathematical proof for every real number. Overlay text must sit on an opaque theme surface.\n\n'
report += '| Theme | Pair | Minimum ratio | Result |\n|---|---|---:|---|\n'
report += ''.join(f"| {c['theme']} | {c['foreground']} / {c['background']} | {c['ratio']:.3f}:1 | {'PASS' if c['ratio']>=4.5 else 'FAIL'} |\n" for c in checks)
ROOT.joinpath('CONTRAST.md').write_text(report,encoding='utf-8')
doc='# Warm Glow tokens\n\nSource of truth: `tokens.json`. Rebuild and verify with `python docs/design/build_tokens.py`. Values below are design specifications, not installed app tokens.\n\n'
doc+='## Color\n\nAuto resolves Rose from 07:00–18:59, Midnight from 19:00–06:59 in device local time. Figma Auto is a static daytime specimen; it cannot follow the clock. Night preview uses Midnight. Maximum two decorative accent hues per theme; semantic feedback colors are reserved for their status meanings.\n\n'
for name,t in themes.items():
    doc+=f'### {name}\n\n| Token | Value |\n|---|---|\n'+''.join(f'| {k} | `{v}` |\n' for k,v in t.items())+'\n'
doc+='`bubbleMineStart` / `bubbleMineEnd` are the requested bubbleMine gradient endpoints. tickSent and tickSeen are bubble-local semantic inks: muted single tick and accented double tick. Do not substitute page primary on a similarly colored bubble. Double-tick shape also conveys seen status. Error status lives below the bubble on bg using danger, with a warning glyph and Retry label.\n\nAll listed text tokens pass 4.5:1 on all four background surfaces, and primaryContrast on primary, both bubble text pairs, and both ticks across the mine gradient pass. Exact results: CONTRAST.md. Border is a functional control outline, not body text; decorative dividers may be subtler.\n\n'
doc+='## Geometry\n\nSpacing: '+', '.join(map(str,data['spacing']))+' dp. Layout uses an 8dp rhythm; 4/12/20 are optical substeps. Radii: 8, 12, 16, 20, 28, pill=999. Typical cards 20, sheets 28 at top, fields 16, bubble 20 with grouped-side 8. Minimum interactive target 48×48dp; small visual controls retain an expanded target. Android frames 412×915, safe-area insets measured at runtime.\n\n'
doc+='## Type\n\n| Style | Font | Size | Line | Weight | Tracking |\n|---|---|---:|---:|---:|---:|\n'+''.join(f"| {t['name']} | {t['font']} | {t['size']} | {t['lineHeight']} | {t['weight']} | {t['letterSpacing']} |\n" for t in type_scale)
doc+='\nSizes/line heights are sp; tracking is dp at baseline scale. Use tabular numerals for clocks. Respect Android font scaling; expand cards and scroll instead of clipping. Font styles verified in Figma: Fraunces SemiBold, Plus Jakarta Sans Regular/Medium/SemiBold/Bold.\n\n## Elevation\n\nAll shadows use shadowColor with the listed opacity. Borders and surfaces must carry hierarchy in AMOLED; shadows are supplementary.\n\n| Level | Offset x/y | Blur | Spread | Opacity | Android dp |\n|---|---|---:|---:|---:|---:|\n'+''.join(f"| {e['level']} | {e['x']}/{e['y']} | {e['blur']} | 0 | {e['opacity']} | {e['androidDp']} |\n" for e in data['elevations'])
doc+='\n## Motion\n\nDurations: instant 90ms; fast 160ms; base 240ms; slow 400ms; hero 600ms. Stagger 40ms, press scale 0.96.\n\n| Spring | Damping | Stiffness | Mass |\n|---|---:|---:|---:|\n'+''.join(f"| {k} | {v['damping']} | {v['stiffness']} | {v['mass']} |\n" for k,v in data['motion']['springs'].items())
doc+='\nEasing cubic Béziers: standard (0.2,0,0,1), enter (0,0,0.2,1), exit (0.4,0,1,1), linear (0,0,1,1). Full: tokens as written. Reduced: no spatial travel, bounce, parallax or looping shimmer; fade ≤160ms, static typing and clock glyphs. Off: immediate state changes, no animated interpolation. Functional progress/timers and video remain legible and update without decorative motion. System reduce-motion takes precedence over Full.\n'
ROOT.joinpath('TOKENS.md').write_text(doc,encoding='utf-8')
print(f'{len(themes)} themes; {len(checks)} contrast pairs; {len(failures)} failures')
for c in failures: print(c)
if failures: raise SystemExit(1)
