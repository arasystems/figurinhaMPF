import { useState, useRef, useEffect, useCallback } from 'react'
import { removeBackground } from '@imgly/background-removal'

// ─── Template coordinates (1080×1397) ───────────────────────────────────────
const BASE_W = 1080
const BASE_H = 1397

// Photo area (upper lime-green zone)
const PHOTO_REGION  = { x: 69,  y: 90,   w: 932, h: 880  }

// Name banner (full-width lime-green rounded rect at bottom of green area)
const NAME_BANNER   = { x: 81,  y: 975,  w: 919, h: 212  }

// Cargo pill (narrower darker-green rounded rect)
const CARGO_BANNER  = { x: 189, y: 1193, w: 655, h: 97   }

// Colors (sampled from art)
const LIME_GREEN = '#B1F222'   // photo area background
const NAME_BG    = '#B1F222'   // same lime-green as art
const CARGO_BG   = '#05C848'   // darker green pill

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [photoImg,      setPhotoImg]      = useState(null)
  const [playerName,    setPlayerName]    = useState('')
  const [playerCargo,   setPlayerCargo]   = useState('')
  const [offsetX,       setOffsetX]       = useState(0)
  const [offsetY,       setOffsetY]       = useState(0)
  const [zoom,          setZoom]          = useState(1.0)
  const [processed,     setProcessed]     = useState(null)
  const [templateReady, setTemplateReady] = useState(false)
  const [dragging,      setDragging]      = useState(false)
  const [lastPos,       setLastPos]       = useState({ x: 0, y: 0 })
  const [isDragOver,    setIsDragOver]    = useState(false)
  const [removing,      setRemoving]      = useState(false)

  const canvasRef    = useRef(null)
  const fileInputRef = useRef(null)

  // ── Process template: make lime-green + medium-green transparent ──────────
  useEffect(() => {
    const img = new Image()
    img.src = '/arte_copa.PNG'
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = img.naturalWidth; off.height = img.naturalHeight
      const ctx = off.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const id = ctx.getImageData(0, 0, off.width, off.height)
      const d  = id.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2]
        const isLime = r > 130 && r < 220 && g > 210 && b < 110
        const isMid  = r < 30  && g > 150 && b < 110
        if (isLime || isMid) d[i+3] = 0
      }
      ctx.putImageData(id, 0, 0)
      setProcessed(off)
      setTemplateReady(true)
    }
  }, [])

  const sx = useCallback(v => processed ? v * processed.width  / BASE_W : v, [processed])
  const sy = useCallback(v => processed ? v * processed.height / BASE_H : v, [processed])

  // ── Render ────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    if (!processed || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const cw = processed.width, ch = processed.height
    canvas.width = cw; canvas.height = ch

    // Fill entire canvas with lime-green (matches art background)
    ctx.fillStyle = LIME_GREEN
    ctx.fillRect(0, 0, cw, ch)

    // ── Photo ──────────────────────────────────────────────────────────────
    if (photoImg) {
      const pr = { x:sx(PHOTO_REGION.x), y:sy(PHOTO_REGION.y), w:sx(PHOTO_REGION.w), h:sy(PHOTO_REGION.h) }
      const aspect = photoImg.naturalWidth / photoImg.naturalHeight
      let dw = pr.w, dh = pr.h
      if (aspect > pr.w/pr.h) { dh=pr.h; dw=dh*aspect } else { dw=pr.w; dh=dw/aspect }
      dw *= zoom; dh *= zoom
      ctx.drawImage(photoImg, pr.x+(pr.w-dw)/2+sx(offsetX), pr.y+(pr.h-dh)/2+sy(offsetY), dw, dh)
    }

    // ── Template overlay ───────────────────────────────────────────────────
    ctx.drawImage(processed, 0, 0)

    // ── Name banner ────────────────────────────────────────────────────────
    const nb = { x:sx(NAME_BANNER.x), y:sy(NAME_BANNER.y), w:sx(NAME_BANNER.w), h:sy(NAME_BANNER.h) }
    ctx.fillStyle = NAME_BG
    ctx.beginPath()
    ctx.roundRect(nb.x, nb.y, nb.w, nb.h, nb.h * 0.3)
    ctx.fill()

    if (playerName.trim()) {
      let fs = Math.round(nb.h * 0.48)
      ctx.fillStyle    = '#0D2200'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `900 ${fs}px "Arial Black", Arial, sans-serif`
      while (ctx.measureText(playerName).width > nb.w * 0.88 && fs > 10) {
        fs--; ctx.font = `900 ${fs}px "Arial Black", Arial, sans-serif`
      }
      ctx.fillText(playerName, nb.x + nb.w/2, nb.y + nb.h/2)
    }

    // ── Cargo pill ─────────────────────────────────────────────────────────
    const cb = { x:sx(CARGO_BANNER.x), y:sy(CARGO_BANNER.y), w:sx(CARGO_BANNER.w), h:sy(CARGO_BANNER.h) }
    ctx.fillStyle = CARGO_BG
    ctx.beginPath()
    ctx.roundRect(cb.x, cb.y, cb.w, cb.h, cb.h * 0.4)
    ctx.fill()

    if (playerCargo.trim()) {
      let fs2 = Math.round(cb.h * 0.46)
      ctx.fillStyle    = '#0D2200'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold ${fs2}px Arial, sans-serif`
      while (ctx.measureText(playerCargo).width > cb.w * 0.88 && fs2 > 8) {
        fs2--; ctx.font = `bold ${fs2}px Arial, sans-serif`
      }
      ctx.fillText(playerCargo, cb.x + cb.w/2, cb.y + cb.h/2)
    }
  }, [processed, photoImg, offsetX, offsetY, zoom, playerName, playerCargo, sx, sy])

  useEffect(() => { render() }, [render])

  // ── Upload + background removal ───────────────────────────────────────────
  const loadImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setRemoving(true); setPhotoImg(null)
    const apply = (src) => {
      const img = new Image(); img.src = src
      img.onload = () => { setPhotoImg(img); setOffsetX(0); setOffsetY(0); setZoom(1.0); setRemoving(false) }
    }
    try { apply(URL.createObjectURL(await removeBackground(file))) }
    catch { const r = new FileReader(); r.onload = e => apply(e.target.result); r.readAsDataURL(file) }
  }

  const handleFileChange = e => loadImageFile(e.target.files?.[0])
  const handleDrop = e => { e.preventDefault(); setIsDragOver(false); loadImageFile(e.dataTransfer.files?.[0]) }
  const getPos = e => e.touches ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : {x:e.clientX,y:e.clientY}
  const onDown = e => { if (!photoImg) return; setDragging(true); setLastPos(getPos(e)) }
  const onMove = e => { if (!dragging) return; const p=getPos(e); setOffsetX(v=>v+(p.x-lastPos.x)); setOffsetY(v=>v+(p.y-lastPos.y)); setLastPos(p) }
  const onUp   = () => setDragging(false)
  const download = () => { const a=document.createElement('a'); a.download=`figurinha-${playerName.replace(/\s+/g,'_')||'jogador'}.png`; a.href=canvasRef.current.toDataURL('image/png'); a.click() }

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <span style={S.emoji}>⚽</span>
          <div>
            <h1 style={S.title}>FIGURINHA DA COPA</h1>
            <p style={S.subtitle}>Copa do Mundo 2026 · Crie a sua figurinha personalizada</p>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* Preview */}
        <div style={S.previewSection}>
          <div style={S.previewLabel}>{photoImg ? '⟵ Arraste para reposicionar' : '⬇ Suba sua foto para começar'}</div>
          <div style={{...S.canvasWrap, cursor: photoImg?(dragging?'grabbing':'grab'):'default'}}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
            {!templateReady && <div style={S.loadOverlay}><div style={S.spinner}/><span>Carregando…</span></div>}
            <canvas ref={canvasRef} style={S.canvas}/>
          </div>
          {photoImg && (
            <div style={S.zoomRow}>
              <span style={S.zoomLbl}>🔍</span>
              <input type="range" min="0.3" max="2.5" step="0.01" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} style={S.slider}/>
              <span style={S.zoomLbl}>{Math.round(zoom*100)}%</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={S.controls}>
          <div style={{...S.uploadZone,...(isDragOver?S.upActive:{}),...(photoImg?S.upDone:{}),...(removing?S.upLoading:{})}}
            onClick={()=>!removing&&fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();if(!removing)setIsDragOver(true)}}
            onDragLeave={()=>setIsDragOver(false)} onDrop={handleDrop}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange}/>
            {removing ? (<><div style={S.upIcon}>✂️</div><div style={S.upTitle}>Removendo fundo…</div><div style={S.upHint}>IA rodando no navegador</div><div style={S.prog}><div style={S.progFill}/></div></>) :
             photoImg  ? (<><div style={S.upIcon}>✅</div><div style={S.upTitle}>Foto carregada!</div><div style={S.upHint}>Clique para trocar</div></>) :
                         (<><div style={S.upIcon}>📸</div><div style={S.upTitle}>Envie sua foto</div><div style={S.upHint}>Clique ou arraste aqui · JPG, PNG</div></>)}
          </div>

          <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>PERSONALIZE</span><div style={S.divLine}/></div>

          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>🏷️ NOME</label>
            <input type="text" placeholder="Ex: Rodrigo Silva" value={playerName} maxLength={25}
              onChange={e=>setPlayerName(e.target.value)} style={S.input}/>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>💼 CARGO / POSIÇÃO</label>
            <input type="text" placeholder="Ex: Atacante" value={playerCargo} maxLength={25}
              onChange={e=>setPlayerCargo(e.target.value)} style={S.input}/>
          </div>

          {photoImg && <div style={S.hint}><strong>💡 Dica:</strong> Arraste a foto no cartão para ajustar. Use o zoom abaixo.</div>}

          <button onClick={download} disabled={!templateReady}
            style={{...S.dlBtn,...(!templateReady?S.dlDisabled:{})}}>⬇ BAIXAR FIGURINHA</button>

          <p style={S.footer}>Imagem gerada localmente — nenhum dado enviado para servidores.</p>
        </div>
      </main>
    </div>
  )
}

// ─── Color palette ───────────────────────────────────────────────────────────
// #EFF1F2  light gray (text on dark)
// #D1D2D5  muted gray (secondary text, borders)
// #C9EED9  light mint (subtle tints)
// #29EC72  bright green (accents, active)
// #23C35F  medium green (buttons, highlights)
// #006643  dark green (header, cards)
// #00482F  deeper green (hover, borders)
// #002A1C  very dark green (page background)

const S = {
  root:        { minHeight:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Poppins',sans-serif", background:'#002A1C' },
  header:      { background:'linear-gradient(90deg,#00482F,#006643)', borderBottom:'3px solid #29EC72', padding:'16px 24px' },
  headerInner: { maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', gap:16 },
  emoji:       { fontSize:40, lineHeight:1 },
  title:       { fontFamily:"'Poppins',sans-serif", fontSize:'1.9rem', fontWeight:700, letterSpacing:'0.04em', color:'#29EC72', lineHeight:1 },
  subtitle:    { fontSize:'0.95rem', fontWeight:300, color:'#C9EED9', marginTop:3 },
  main:        { flex:1, maxWidth:1100, margin:'0 auto', width:'100%', padding:'32px 16px', display:'flex', gap:40, alignItems:'flex-start', flexWrap:'wrap', justifyContent:'center' },
  previewSection: { display:'flex', flexDirection:'column', alignItems:'center', gap:12 },
  previewLabel:   { fontSize:'0.75rem', fontWeight:600, color:'#23C35F', textTransform:'uppercase', letterSpacing:'0.1em' },
  canvasWrap:  { position:'relative', borderRadius:14, overflow:'hidden', boxShadow:'0 0 0 1px #00482F, 0 0 40px rgba(41,236,114,0.12), 0 24px 64px rgba(0,0,0,0.6)', userSelect:'none' },
  canvas:      { display:'block', width:320, height:'auto', maxWidth:'90vw' },
  loadOverlay: { position:'absolute', inset:0, background:'rgba(0,42,28,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'#C9EED9', zIndex:10 },
  spinner:     { width:32, height:32, border:'3px solid rgba(41,236,114,0.15)', borderTop:'3px solid #29EC72', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  zoomRow:     { display:'flex', alignItems:'center', gap:10, width:320, maxWidth:'90vw' },
  zoomLbl:     { fontSize:'0.8rem', fontWeight:600, color:'#23C35F', minWidth:36, textAlign:'center' },
  slider:      { flex:1, accentColor:'#29EC72', cursor:'pointer' },
  controls:    { flex:'1 1 320px', maxWidth:420, display:'flex', flexDirection:'column', gap:18, minWidth:280 },
  uploadZone:  { border:'2px dashed #00482F', borderRadius:14, padding:'28px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.2s', background:'rgba(0,72,47,0.3)' },
  upActive:    { border:'2px dashed #29EC72', background:'rgba(41,236,114,0.08)', transform:'scale(1.01)' },
  upDone:      { border:'2px solid #23C35F', background:'rgba(35,195,95,0.08)' },
  upLoading:   { border:'2px dashed #006643', background:'rgba(0,102,67,0.2)', cursor:'not-allowed' },
  upIcon:      { fontSize:36, marginBottom:8 },
  upTitle:     { fontSize:'1rem', fontWeight:600, color:'#EFF1F2', letterSpacing:'0.01em' },
  upHint:      { fontSize:'0.8rem', fontWeight:300, color:'#D1D2D5', marginTop:4 },
  prog:        { height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden', width:'80%', margin:'14px auto 0' },
  progFill:    { height:'100%', width:'40%', background:'#29EC72', borderRadius:2, animation:'slide 1.2s ease-in-out infinite' },
  divider:     { display:'flex', alignItems:'center', gap:12, margin:'2px 0' },
  divLine:     { flex:1, height:1, background:'#00482F' },
  divText:     { fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.18em', color:'#23C35F' },
  fieldGroup:  { display:'flex', flexDirection:'column', gap:7 },
  fieldLabel:  { fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.1em', color:'#C9EED9', textTransform:'uppercase' },
  input:       { background:'#00482F', border:'1.5px solid #006643', borderRadius:9, padding:'13px 15px', color:'#EFF1F2', fontSize:'1.1rem', fontFamily:"'Poppins',sans-serif", fontWeight:600, outline:'none', transition:'border-color 0.2s' },
  hint:        { background:'rgba(0,72,47,0.5)', border:'1px solid #006643', borderRadius:9, padding:'10px 14px', fontSize:'0.82rem', fontWeight:300, color:'#C9EED9', lineHeight:1.7 },
  dlBtn:       { background:'linear-gradient(135deg,#29EC72,#23C35F)', border:'none', borderRadius:11, padding:'17px', color:'#002A1C', fontSize:'1.2rem', fontFamily:"'Poppins',sans-serif", fontWeight:700, letterSpacing:'0.06em', cursor:'pointer', boxShadow:'0 4px 24px rgba(41,236,114,0.3)' },
  dlDisabled:  { opacity:0.4, cursor:'not-allowed' },
  footer:      { fontSize:'0.72rem', fontWeight:300, color:'#006643', textAlign:'center' },
}
