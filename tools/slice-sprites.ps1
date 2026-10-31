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
    // Fuellt das Polygon glatt aus seinem hellen Rand heraus: So verschwindet das aufgemalte
    // Gesicht, der Farbverlauf des Koerpers bleibt. Dunkle Randpixel (Umrisse) zaehlen nicht mit.
    public static Bitmap Erase(Bitmap src, PointF[] poly) {
        int w=src.Width, h=src.Height;
        var res = (Bitmap)src.Clone();
        var mask = new Bitmap(w,h,PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(mask)) g.FillPolygon(Brushes.White, poly);
        int s, sm; var a = Bytes(res, out s); var mb = Bytes(mask, out sm);
        mask.Dispose();
        var inside = new bool[w*h];
        var px = new float[3*w*h];
        var list = new System.Collections.Generic.List<int>();
        for (int i=0;i<w*h;i++) {
            int o=(i/w)*s+(i%w)*4;
            for (int c=0;c<3;c++) px[3*i+c]=a[o+c];
            if (mb[(i/w)*sm+(i%w)*4+3]>128) { inside[i]=true; list.Add(i); }
        }
        var known = new bool[w*h];
        for (int i=0;i<w*h;i++) known[i] = !inside[i] && px[3*i]+px[3*i+1]+px[3*i+2]>330 && a[(i/w)*s+(i%w)*4+3]>200;
        int[] nb = { -1, 1, -w, w };
        for (int it=0;it<1500;it++) foreach (int i in list) {
            float r=0,gg=0,b=0; int n=0;
            foreach (int d in nb) {
                int j=i+d;
                if (j<0||j>=w*h||!(known[j]||inside[j])) continue;
                if (inside[j] && it==0 && !known[j]) continue;
                r+=px[3*j]; gg+=px[3*j+1]; b+=px[3*j+2]; n++;
            }
            if (n==0) continue;
            px[3*i]=r/n; px[3*i+1]=gg/n; px[3*i+2]=b/n; known[i]=true;
        }
        foreach (int i in list) {
            int o=(i/w)*s+(i%w)*4;
            for (int c=0;c<3;c++) a[o+c]=(byte)Math.Max(0,Math.Min(255,px[3*i+c]));
        }
        Store(res,a);
        return res;
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
    @{ name='man_body'; src='Runkelman.png'; open=6; ring=$false; poly=@(460,840, 470,820, 620,782, 665,793, 680,793, 690,775, 770,770, 975,840, 975,1480, 460,1480);
       erase=@(505,890, 600,850, 800,850, 875,900, 875,1148, 505,1148) },
    @{ name='inv_body'; src='Runkelinvalide.png'; open=6; ring=$false; poly=@(505,1130, 515,1000, 600,810, 650,795, 780,776, 900,780, 1010,870, 1040,1020, 1040,1300, 990,1370, 880,1395, 830,1408, 800,1425, 762,1510, 725,1415, 690,1412, 590,1385, 530,1270);
       erase=@(684,855, 760,850, 795,885, 860,912, 880,935, 905,985, 905,1100, 955,1140, 955,1225, 580,1225, 580,1140, 622,1090, 625,1020, 644,985, 660,945, 684,905) },
    @{ name='inv_arm';  src='Runkelinvalide.png'; open=0; ring=$false; poly=@(15,1320, 360,1070, 512,1080, 512,1115, 450,1190, 80,1395, 15,1395) },
    @{ name='inv_leg';  src='Runkelinvalide.png'; open=0; ring=$false; poly=@(828,1405, 855,1405, 855,1445, 915,1445, 955,1640, 1065,1645, 1070,1765, 950,1865, 850,1865, 790,1505) },
    @{ name='inv_cane'; src='Runkelinvalide.png'; open=0; ring=$false; poly=@(1255,1205, 1335,1180, 1335,1290, 1255,1860, 1190,1860, 1190,1500) }
)

$cache = @{}
$data = @()
foreach ($p in $parts) {
    if (-not $cache.ContainsKey($p.src)) { $cache[$p.src] = Load-Scaled $p.src }
    $source = $cache[$p.src]
    if ($p.erase) { $source = [Slicer]::Erase($source, (Poly $p.erase)) }
    $r = [Slicer]::Cut($source, (Poly $p.poly), $p.open, $p.ring, (Join-Path $out_dir ($p.name + '.png')))
    if ($p.erase) { $source.Dispose() }
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

