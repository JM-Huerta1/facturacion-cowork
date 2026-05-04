'use client'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '../../../../lib/supabase'
import Layout from '../../../../lib/layout'

const LOTE = 50

function generarCodigo(id) {
  return `PROD-${String(id).trim()}`
}

function resolverSedeIds(sedeNombre, sedes) {
  const nombre = String(sedeNombre || '').trim().toUpperCase()
  if (!nombre || nombre === 'TODAS') return null
  const sede = sedes.find(s =>
    s.nombre.toUpperCase().includes(nombre) || nombre.includes(s.nombre.toUpperCase())
  )
  return sede ? [sede.id] : null
}

function parsearFilas(rows, sedes) {
  return rows
    .slice(1)
    .filter(r => r[2] && String(r[2]).trim())
    .map(r => {
      const sedeNombre = String(r[1] || '').trim()
      return {
        _sede: sedeNombre || 'TODAS',
        nombre: String(r[2] || '').trim(),
        codigo: generarCodigo(r[0]),
        precio_neto: parseFloat(r[3]) || 0,
        cuenta_contable: String(r[4] || '').trim(),
        nombre_cuenta_contable: String(r[5] || '').trim(),
        sede_ids: resolverSedeIds(sedeNombre, sedes),
        alicuota_iva: 21,
        active: true,
      }
    })
}

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportarProductos() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [sedes, setSedes] = useState([])
  const [productos, setProductos] = useState([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [erroresDetalle, setErroresDetalle] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
    supabase.from('sedes').select('id, nombre').then(({ data }) => setSedes(data || []))
  }, [])

  async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    setResultado(null)
    setProductos([])
    try {
      const rows = await leerArchivo(file)
      setProductos(parsearFilas(rows, sedes))
    } catch {
      setError('No se pudo leer el archivo. Asegurate de que sea un XLS o XLSX válido.')
    }
  }

  async function importar() {
    setImportando(true)
    setProgreso(0)
    setResultado(null)
    setErroresDetalle([])
    let ok = 0
    let fail = 0
    const errores = []
    const paraInsertar = productos.map(({ _sede, ...p }) => p)

    for (let i = 0; i < paraInsertar.length; i += LOTE) {
      const lote = paraInsertar.slice(i, i + LOTE)
      const { error: errLote } = await supabase.from('productos').upsert(lote, { onConflict: 'codigo' })

      if (!errLote) {
        ok += lote.length
      } else {
        // El lote falló — reintentamos uno por uno para identificar cuál(es)
        for (const prod of lote) {
          const { error: errInd } = await supabase.from('productos').upsert(prod, { onConflict: 'codigo' })
          if (!errInd) {
            ok++
          } else {
            fail++
            const detalle = {
              nombre: prod.nombre,
              codigo: prod.codigo,
              mensaje: errInd.message,
              hint: errInd.hint || null,
              code: errInd.code || null,
            }
            errores.push(detalle)
            console.error(`[Importar] Falló "${prod.nombre}" (${prod.codigo}):`, errInd)
          }
        }
      }

      setProgreso(Math.min(i + LOTE, paraInsertar.length))
      setErroresDetalle([...errores])
    }

    setImportando(false)
    setResultado({ ok, fail })
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: '#333', background: '#fff' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Importar productos</h1>
          <p style={{ color: '#888', fontSize: '13px' }}>Importá productos masivamente desde un archivo Excel (.xls / .xlsx)</p>
        </div>

        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '12px' }}>
            Seleccioná el archivo
          </label>
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={onFile}
            disabled={importando}
            style={{ ...inputStyle, cursor: 'pointer', padding: '6px 10px' }}
          />
          <p style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
            Columnas: A (ignorar), B (sede), C (descripción → nombre y código), D (importe → precio neto), E (cuenta contable), F (ignorar)
          </p>
        </div>

        {error && (
          <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#C62828', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {productos.length > 0 && !resultado && (
          <>
            <div style={{ background: '#F0F4FF', border: '1px solid #C5D8F6', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#185FA5', fontWeight: '600' }}>
                {productos.length} producto{productos.length !== 1 ? 's' : ''} detectado{productos.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={importar}
                disabled={importando}
                style={{ padding: '9px 20px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: importando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: importando ? 0.7 : 1 }}
              >
                {importando ? `Importando... (${progreso}/${productos.length})` : `Importar ${productos.length} productos`}
              </button>
            </div>

            {importando && (
              <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  <span>Progreso</span>
                  <span>{progreso} / {productos.length}</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#378ADD', height: '100%', width: `${(progreso / productos.length) * 100}%`, transition: 'width .3s ease', borderRadius: '999px' }} />
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Vista previa — primeros {Math.min(10, productos.length)} registros
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                    {['Sede', 'Nombre', 'Código', 'Precio neto', 'Cuenta contable', 'IVA'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productos.slice(0, 10).map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: p._sede === 'TODAS' ? '#E8F5E9' : '#FFF3E0', color: p._sede === 'TODAS' ? '#2E7D32' : '#E65100' }}>
                          {p._sede}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: '#1a1a2e' }}>{p.nombre}</td>
                      <td style={{ padding: '10px 16px' }}><code style={{ background: '#F0F4FF', color: '#378ADD', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{p.codigo}</code></td>
                      <td style={{ padding: '10px 16px', color: '#666' }}>${p.precio_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 16px', color: '#666', fontSize: '12px' }}>{p.cuenta_contable || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#666', fontSize: '12px' }}>21%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {resultado && (
          <>
            <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: erroresDetalle.length ? '16px' : 0 }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                {resultado.fail === 0 ? '✅' : resultado.ok === 0 ? '❌' : '⚠️'}
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a2e', marginBottom: '8px' }}>Importación finalizada</h2>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
                {resultado.ok > 0 && (
                  <span style={{ padding: '6px 16px', background: '#E8F5E9', color: '#2E7D32', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                    {resultado.ok} importado{resultado.ok !== 1 ? 's' : ''} correctamente
                  </span>
                )}
                {resultado.fail > 0 && (
                  <span style={{ padding: '6px 16px', background: '#FFEBEE', color: '#C62828', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                    {resultado.fail} fallido{resultado.fail !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <a href="/dashboard/productos" style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}>
                  Ver productos
                </a>
                <button onClick={() => { setProductos([]); setResultado(null); setProgreso(0); setErroresDetalle([]) }} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
                  Importar otro archivo
                </button>
              </div>
            </div>

            {erroresDetalle.length > 0 && (
              <div style={{ background: 'white', border: '1px solid #FFCDD2', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #FFCDD2', background: '#FFEBEE', fontSize: '12px', fontWeight: '700', color: '#C62828', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Errores detallados ({erroresDetalle.length})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#FFF8F8', borderBottom: '1px solid #f5d0d0' }}>
                      {['Nombre', 'Código', 'Error', 'Hint', 'Code'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontWeight: '600', fontSize: '11px', color: '#C62828', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {erroresDetalle.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #fff0f0' }}>
                        <td style={{ padding: '9px 14px', fontWeight: '600', color: '#1a1a2e' }}>{e.nombre}</td>
                        <td style={{ padding: '9px 14px' }}><code style={{ background: '#FFEBEE', color: '#C62828', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{e.codigo}</code></td>
                        <td style={{ padding: '9px 14px', color: '#555', maxWidth: '300px', wordBreak: 'break-word' }}>{e.mensaje}</td>
                        <td style={{ padding: '9px 14px', color: '#888', maxWidth: '200px', wordBreak: 'break-word' }}>{e.hint || '—'}</td>
                        <td style={{ padding: '9px 14px' }}><code style={{ background: '#f5f5f5', color: '#666', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{e.code || '—'}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
