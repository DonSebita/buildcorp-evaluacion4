import sys
from xml.sax.saxutils import escape as e
W,H=1990,1260
out=[]
def a(s): out.append(s)
a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="DejaVu Sans, Arial, sans-serif">')
a('''<defs>
<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#232F3E"/></marker>
<marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7A7F87"/></marker>
</defs>''')
a(f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>')
a('<text x="30" y="44" font-size="28" font-weight="bold" fill="#232F3E">BuildCorp · Arquitectura en AWS (Evaluación 4)</text>')
a('<text x="30" y="70" font-size="15" fill="#545B64">Región us-east-1 · AWS Academy · Django REST + Vite SPA · Evidencia E12</text>')

def group(x,y,w,h,label,color,dash=None,fill="none",fs=15,bold=True):
    d=f' stroke-dasharray="{dash}"' if dash else ''
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{color}" stroke-width="2"{d}/>')
    a(f'<text x="{x+12}" y="{y+22}" font-size="{fs}" font-weight="{"bold" if bold else "normal"}" fill="{color}">{e(label)}</text>')

def card(x,y,w,h,title,color,lines,sub=None):
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#FFFFFF" stroke="{color}" stroke-width="2"/>')
    a(f'<path d="M{x},{y+8} a8,8 0 0 1 8,-8 h{w-16} a8,8 0 0 1 8,8 v28 h-{w} z" fill="{color}"/>')
    a(f'<text x="{x+12}" y="{y+25}" font-size="16" font-weight="bold" fill="#FFFFFF">{e(title)}</text>')
    yy=y+56
    for ln in lines:
        b = ln.startswith('*')
        t = ln[1:] if b else ln
        a(f'<text x="{x+12}" y="{yy}" font-size="13.5" fill="#232F3E"{" font-weight=\"bold\"" if b else ""}>{e(t)}</text>')
        yy+=19

def arrow(pts,label=None,lx=None,ly=None,dashed=False,anchor="start",both=False):
    col="#7A7F87" if dashed else "#232F3E"
    m="ag" if dashed else "ar"
    d=" ".join(("M" if i==0 else "L")+f"{x},{y}" for i,(x,y) in enumerate(pts))
    da=' stroke-dasharray="7,5"' if dashed else ''
    ms=f' marker-start="url(#{m})"' if both else ''
    a(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2.2"{da} marker-end="url(#{m})"{ms}/>')
    if label:
        for i,l in enumerate(label.split("\n")):
            a(f'<text x="{lx}" y="{ly+i*16}" font-size="13" text-anchor="{anchor}" fill="#FFFFFF" font-weight="bold" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round">{e(l)}</text>')
            a(f'<text x="{lx}" y="{ly+i*16}" font-size="13" text-anchor="{anchor}" fill="{col}" font-weight="bold">{e(l)}</text>')

# ---- external actors
card(30,370,210,140,"Usuarios",'#232F3E',["Navegador web","Admin, Bodeguero,","Encargado, Ventas","(HTTPS)"])
card(30,590,210,110,"Administrador",'#545B64',["Consola AWS y SSH","desde IP autorizada"])
card(30,880,210,150,"GitHub",'#24292F',["DonSebita/","buildcorp-evaluacion4","rama main"])
card(1760,390,210,130,"Correo",'#545B64',["Suscriptor del tema","SNS (email","confirmado)"])

# ---- AWS cloud
group(275,95,1450,1130,"AWS Cloud · us-east-1 (AWS Academy, cuenta del laboratorio)",'#232F3E',fs=17)
# VPC
group(300,345,1110,460,"VPC por defecto (172.31.0.0/16) · subredes públicas por AZ",'#248814',fill="#F2F8F0")
# SGs
group(325,385,345,400,"sg-frontend",'#DD344C',dash="6,4",fs=14)
a('<text x="337" y="428" font-size="12" fill="#DD344C">Entrada: 80, 443 (0.0.0.0/0) · 22 (IP admin)</text>')
group(715,385,345,400,"sg-backend",'#DD344C',dash="6,4",fs=14)
a('<text x="727" y="428" font-size="12" fill="#DD344C">Entrada: 80 (API Gateway) · 22 (IP admin)</text>')
group(1100,385,290,400,"buildcorp-sg-rds",'#DD344C',dash="6,4",fs=14)
a('<text x="1112" y="428" font-size="12" fill="#DD344C">Entrada: 5432 solo desde sg-backend</text>')

card(340,445,315,320,"EC2 Frontend",'#ED7100',[
 "Ubuntu · t3.small",
 "*Nginx + SPA Vite (estática)",
 "HTTPS con Let's Encrypt",
 "(certbot.timer renueva)",
 "HTTP 80 → redirige a 443",
 "",
 "*Dominio:",
 "buildcorp.184-197-126-20",
 ".sslip.io",
 "",
 "Auto-deploy: timer systemd",
 "cada 2 min (git pull)"])
card(730,445,315,320,"EC2 Backend",'#ED7100',[
 "Ubuntu · t3.small",
 "*Nginx → Gunicorn → Django REST",
 "Autenticación JWT (SimpleJWT)",
 "Roles y permisos por grupo",
 "*Rechaza con 403 si falta",
 "*la cabecera X-Origin-Verify",
 "Contraseñas: hash PBKDF2/Argon2",
 ".env con permisos 600",
 "cron diario: revisar_morosidad,",
 "revisar_mantenimientos",
 "Auto-deploy: timer systemd",
 "cada 2 min (git pull)"])
card(1115,445,260,320,"Amazon RDS",'#3B48CC',[
 "*PostgreSQL · buildcorp-db",
 "Sin acceso público",
 "Cifrado en reposo (KMS)",
 "Conexión SSL obligatoria",
 "(sslmode=require)",
 "Backups automáticos",
 "con retención",
 "Puerto 5432"])

# API Gateway
card(560,130,450,170,"Amazon API Gateway (HTTP API)",'#E7157B',[
 "*buildcorp-api · f5nr8vmiu8",
 "Ruta ANY /api/{proxy+} → EC2 Backend",
 "Throttling: 2 req/s, ráfaga 5 (429)",
 "Agrega cabecera X-Origin-Verify",
 "Access logs → CloudWatch Logs"])

# S3 + KMS
card(730,860,315,215,"Amazon S3",'#3F8624',[
 "*buildcorp-sebastian-assets",
 "Block Public Access activado",
 "Cifrado SSE del lado servidor",
 "Política: solo HTTPS",
 "(aws:SecureTransport)",
 "Fotos, manuales y estáticos",
 "URLs prefirmadas con expiración"])
card(1115,860,260,130,"AWS KMS",'#DD344C',[
 "Clave de cifrado de RDS",
 "y de sus snapshots"])

# Right column: monitoring & backups
card(1445,130,255,195,"Amazon CloudWatch",'#E7157B',[
 "Dashboard: CPU EC2, RDS,",
 "4xx/5xx de API Gateway",
 "Métricas y logs",
 "*Alarmas → SNS"])
card(1445,385,255,140,"Amazon SNS",'#E7157B',[
 "*Tema buildcorp-alertas",
 "Suscripción por email",
 "Alarmas y avisos de backup"])
card(1445,590,255,130,"EventBridge Scheduler",'#E7157B',[
 "*rate(7 hours)",
 "Invoca la Lambda de",
 "snapshots"])
card(1445,780,255,160,"AWS Lambda",'#ED7100',[
 "*buildcorp-snapshot-7h",
 "Python + boto3 (LabRole)",
 "Crea snapshot manual de RDS",
 "Borra snapshots > 72 h",
 "Publica resultado en SNS"])
card(1445,1000,255,120,"Snapshots de RDS",'#3B48CC',[
 "Manuales cada 7 h",
 "Retención: 72 horas",
 "Restaurables a instancia"])

# ---- arrows (data flow)
arrow([(240,410),(270,410),(270,215),(560,215)],"(1) HTTPS: fetch /api/* + JWT",300,205)
arrow([(240,470),(340,470)],"(2) HTTPS 443",246,452)
a('<text x="248" y="490" font-size="12" fill="#232F3E">(SPA)</text>')
arrow([(990,300),(990,445)],"(3) HTTP + X-Origin-Verify",780,325)
arrow([(1045,600),(1115,600)],"(4) 5432",1050,590)
a('<text x="1050" y="625" font-size="12" fill="#232F3E" font-weight="bold">SSL</text>')
arrow([(887,765),(887,860)],"(5) boto3: subir/leer",897,822)
a('<text x="897" y="838" font-size="12" fill="#232F3E" font-weight="bold">+ URLs prefirmadas</text>')

a('<text x="285" y="250" font-size="12" fill="#545B64">(la SPA se ejecuta en el navegador</text>')
a('<text x="285" y="266" font-size="12" fill="#545B64"> y llama a la API por API Gateway)</text>')
# KMS -> RDS
arrow([(1245,860),(1245,765)],"cifra",1255,820,dashed=True)
# admin ssh
arrow([(240,645),(340,645)],"SSH 22",250,637,dashed=True)
# github auto-deploy
arrow([(240,955),(312,955),(312,740),(340,740)],"git pull cada 2 min",250,1052,dashed=True)
arrow([(312,820),(700,820),(700,740),(730,740)],None,dashed=True)
# monitoring
arrow([(1010,170),(1445,170)],"access logs + métricas 4xx",1030,160,dashed=True)
arrow([(1410,360),(1445,300)],None,dashed=True)
a('<text x="1300" y="340" font-size="12" fill="#7A7F87" font-weight="bold">métricas EC2/RDS</text>')
arrow([(1572,325),(1572,385)],"alarma",1582,362)
arrow([(1700,455),(1760,455)],"email",1705,445)
arrow([(1572,720),(1572,780)],"invoca",1582,756)
arrow([(1572,940),(1572,1000)],"crea / borra",1582,976)
arrow([(1445,860),(1400,860),(1400,835),(1300,835),(1300,765)],None)
a('<text x="1308" y="828" font-size="12" fill="#232F3E" font-weight="bold">CreateDBSnapshot</text>')
arrow([(1700,830),(1716,830),(1716,500),(1700,500)],None)
a('<text x="1734" y="700" font-size="12" fill="#232F3E" font-weight="bold" text-anchor="middle" transform="rotate(-90 1734 700)">notifica</text>')

# legend
lx,ly=30,1090
a(f'<rect x="{lx}" y="{ly}" width="235" height="140" rx="6" fill="#FAFAFA" stroke="#D5DBDB"/>')
a(f'<text x="{lx+12}" y="{ly+24}" font-size="14" font-weight="bold" fill="#232F3E">Leyenda</text>')
a(f'<path d="M{lx+12},{ly+48} h50" stroke="#232F3E" stroke-width="2.2" marker-end="url(#ar)"/>')
a(f'<text x="{lx+72}" y="{ly+52}" font-size="12">Flujo de datos</text>')
a(f'<path d="M{lx+12},{ly+74} h50" stroke="#7A7F87" stroke-width="2.2" stroke-dasharray="7,5" marker-end="url(#ag)"/>')
a(f'<text x="{lx+72}" y="{ly+78}" font-size="12">Gestión / monitoreo</text>')
a(f'<rect x="{lx+12}" y="{ly+92}" width="50" height="16" fill="none" stroke="#DD344C" stroke-dasharray="6,4" stroke-width="2"/>')
a(f'<text x="{lx+72}" y="{ly+105}" font-size="12">Security Group</text>')
a(f'<text x="{lx+12}" y="{ly+128}" font-size="12">(1)–(5) orden de una petición</text>')
a('</svg>')
open(sys.argv[1],'w').write("\n".join(out))
