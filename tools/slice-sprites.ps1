# Schneidet die Runkel-Vorlagen aus ../input in einzelne Rig-Teile.
# Einmalig auszufuehren: das Spiel braucht nur das Ergebnis in assets/sprites und js/sprite-data.js.
# Aufruf aus dem Ordner running_runkel:  powershell -ExecutionPolicy Bypass -File tools\slice-sprites.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$input_dir = Join-Path (Split-Path -Parent $root) 'input'
$out_dir = Join-Path $root 'assets\sprites'
New-Item -ItemType Directory -Force $out_dir | Out-Null

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Slicer {
    static byte[] Bytes(Bitmap b, out int stride) {
        var d = b.LockBits(new Rectangle(0,0,b.Width,b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        stride = d.Stride;
        var a = new byte[stride*b.Height];
        Marshal.Copy(d.Scan0, a, 0, a.Length);
        b.UnlockBits(d);
        return a;
    }
    static void Store(Bitmap b, byte[] a) {
        var d = b.LockBits(new Rectangle(0,0,b.Width,b.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        Marshal.Copy(a, 0, d.Scan0, a.Length);
        b.UnlockBits(d);
    }
    static bool[] Morph(bool[] m, int w, int h, int r, bool erode) {
        var o = new bool[m.Length];
        for (int y=0;y<h;y++) for (int x=0;x<w;x++) {
            bool res = erode;
            for (int dy=-r;dy<=r && res==erode;dy++) for (int dx=-r;dx<=r;dx++) {
                if (dx*dx+dy*dy>r*r) continue;
                int nx=x+dx, ny=y+dy;
                bool v = nx>=0&&ny>=0&&nx<w&&ny<h && m[ny*w+nx];
                if (erode && !v) { res=false; break; }
                if (!erode && v) { res=true; break; }
            }
            o[y*w+x]=res;
        }
        return o;
    }
    // Maskiert das Bild mit einem Polygon; optional entfernt ein Opening duenne Linien
    // (Arme, Beine, Speedlines), die im Spiel neu gezeichnet werden.
    public static int[] Cut(Bitmap src, PointF[] poly, int openR, bool dropRing, string path) {
        int w=src.Width, h=src.Height;
        var part = new Bitmap(w,h,PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(part)) {
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using (var br = new TextureBrush(src)) g.FillPolygon(br, poly);
        }
        int s; var a = Bytes(part, out s);
        if (dropRing) for (int i=0;i<a.Length;i+=4)
            if (a[i+2]>195 && a[i+1]>195 && a[i]<175) {
                // Der Ring verlaeuft vor dem Stiel: dort Blattgruen, sonst transparent.
                int py=(i/4)/w, px=(i/4)%w; double u=(1414.0/w)*(2480.0/2480.0);
                bool stem = px*u>775 && px*u<890 && py*u>680 && py*u<760;
                if (stem) { a[i]=47; a[i+1]=189; a[i+2]=167; } else a[i+3]=0;
            }
        if (openR>0) {
            var m = new bool[w*h];
            for (int y=0;y<h;y++) for (int x=0;x<w;x++) m[y*w+x]=a[y*s+x*4+3]>128;
            var keep = Morph(Morph(m,w,h,openR,true),w,h,openR+2,false);
            for (int y=0;y<h;y++) for (int x=0;x<w;x++) if(!keep[y*w+x]) a[y*s+x*4+3]=0;
        }
        int x0=w,y0=h,x1=-1,y1=-1;
        for (int y=0;y<h;y++) for (int x=0;x<w;x++) if(a[y*s+x*4+3]>8){
            if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
        }
        Store(part,a);
        var r = new Rectangle(x0,y0,x1-x0+1,y1-y0+1);
        using (var c = part.Clone(r,PixelFormat.Format32bppArgb)) c.Save(path, ImageFormat.Png);
        part.Dispose();
        return new[]{x0,y0,r.Width,r.Height};
    }
}
'@

# Vorlagen-Koordinaten: "Anzeige-Einheiten" einer 1414x2000 grossen Ansicht. Das Rig rechnet in denselben Einheiten.
$unit = 2480.0 / 1414.0
$scale = 0.35
$f = $unit * $scale

function Load-Scaled($name) {
    $img = [System.Drawing.Image]::FromFile((Join-Path $input_dir $name))
    $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose(); $img.Dispose()
    return $bmp
}

function Poly($coords) {
    $pts = New-Object 'System.Drawing.PointF[]' ($coords.Count / 2)
    for ($i = 0; $i -lt $pts.Length; $i++) {
        $pts[$i] = New-Object System.Drawing.PointF(($coords[2*$i] * $f), ($coords[2*$i+1] * $f))
    }
    return ,$pts
}

$parts = @(
    @{ name='man_leaves';    src='Runkelman.png';    open=6; ring=$false; poly=@(0,0, 1414,0, 1414,770, 770,770, 690,775, 680,793, 665,793, 620,782, 470,820, 400,940, 0,960) },
    @{ name='man_body';      src='Runkelman.png';    open=6; ring=$false; poly=@(460,840, 470,820, 620,782, 665,793, 680,793, 690,775, 770,770, 975,840, 975,1480, 460,1480) },
    @{ name='inv_leaves';    src='Runkelinvalide.png'; open=0; ring=$true; poly=@(790,792, 775,680, 820,480, 850,280, 900,270, 1005,130, 1085,130, 1095,280, 1000,415, 1200,380, 1310,410, 1400,490, 1290,515, 1100,565, 885,720, 815,790) },
    @{ name='inv_rest';      src='Runkelinvalide.png'; open=0; ring=$false; poly=@(0,1070, 490,1060, 520,960, 600,800, 780,786, 900,770, 1010,870, 1040,1020, 1414,1020, 1414,2000, 0,2000) }
)

$cache = @{}
$data = @()
foreach ($p in $parts) {
    if (-not $cache.ContainsKey($p.src)) { $cache[$p.src] = Load-Scaled $p.src }
    $r = [Slicer]::Cut($cache[$p.src], (Poly $p.poly), $p.open, $p.ring, (Join-Path $out_dir ($p.name + '.png')))
    $vals = ($r | ForEach-Object { [math]::Round($_ / $f, 1).ToString([cultureinfo]::InvariantCulture) }) -join ','
    $data += "  $($p.name): [$vals]"
    "$($p.name): $($r -join ' ') px"
}
foreach ($b in $cache.Values) { $b.Dispose() }

# Wappen fuer Titel und Abspann
$w = [System.Drawing.Image]::FromFile((Join-Path $input_dir 'Wappen_2.png'))
$tw = 420; $th = [int]($w.Height * $tw / $w.Width)
$bmp = New-Object System.Drawing.Bitmap($tw, $th, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($w, 0, 0, $tw, $th)
$g.Dispose(); $w.Dispose()
$bmp.Save((Join-Path $out_dir 'wappen.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$js = "// Erzeugt von tools/slice-sprites.ps1 - [x, y, Breite, Hoehe] in Vorlagen-Einheiten`nwindow.RR = window.RR || {};`nRR.SPRITE_PARTS = {`n" + ($data -join ",`n") + "`n};`n"
[System.IO.File]::WriteAllText((Join-Path $root 'js\sprite-data.js'), $js)

