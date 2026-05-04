'use client'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '../../../../lib/supabase'
import Layout from '../../../../lib/layout'

const LOTE = 50

function mapearCondIva(valor) {
  if (!valor) return 'CF'
  const v = String(valor).trim()
  if (v === 'Resp. Insc.' || v === 'Responsable Inscripto') return 'RI'
  if (v === 'Monotributo' || v === 'Monotributista') return 'MT'
  if (v === 'Consumidor Final') return 'CF'
  if (v === 'Exento' || v === 'No Responsable') return 'EX'
  if (v === 'Exterior') return 'I'
  return 'CF'
}

function parsearArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const clientes = rows
          .slice(1)
          .filter(r => r[0] && String(r[0]).trim())
          .map(r => ({
            razon_social: String(r[0] || '').trim(),
            direccion: String(r[4] || '').trim(),
            cond_iva: mapearCondIva(r[19]),
            cuit: String(r[20] || '').trim(),
            email: String(r[31] || '').trim(),
            active: true,
          }))
        resolve(clientes)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportarClientes() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [clientes, setClientes] = useState([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
  }, [])

  async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    setResultado(null)
    setClientes([])
    try {
      const parsed = await parsearArchivo(file)
      setClientes(parsed)
    } catch {
      setError('No se pudo leer el archivo. Asegurate de que sea un XLS o XLSX válido.')
    }
  }

  async function importar() {
    setImportando(true)
    setProgreso(0)
    setResultado(null)
    let ok = 0
    let fail = 0
    for (let i = 0; i < clientes.length; i += LOTE) {
      const lote = clientes.slice(i, i + LOTE)
      const { error } = await supabase.from('clientes').insert(lote)
      if (error) fail += lote.length
      else ok += lote.length
      setProgreso(Math.min(i + LOTE, clientes.length))
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
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Importar clientes</h1>
          <p style={{ color: '#888', fontSize: '13px' }}>Importá clientes masivamente desde un archivo Excel (.xls / .xlsx)</p>
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
            Columnas usadas: A (razón social), E (dirección), T (condición IVA), U (CUIT), AF (email)
          </p>
        </div>

        {error && (
          <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#C62828', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {clientes.length > 0 && !resultado && (
          <>
            <div style={{ background: '#F0F4FF', border: '1px solid #C5D8F6', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: '#185FA5', fontWeight: '600' }}>
                {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} detectado{clientes.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={importar}
                disabled={importando}
                style={{ padding: '9px 20px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: importando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: importando ? 0.7 : 1 }}
              >
                {importando ? `Importando... (${progreso}/${clientes.length})` : `Importar ${clientes.length} clientes`}
              </button>
            </div>

            {importando && (
              <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  <span>Progreso</span>
                  <span>{progreso} / {clientes.length}</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#378ADD', height: '100%', width: `${(progreso / clientes.length) * 100}%`, transition: 'width .3s ease', borderRadius: '999px' }} />
                </div>
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Vista previa — primeros {Math.min(10, clientes.length)} registros
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                    {['Razón social', 'CUIT', 'Cond. IVA', 'Dirección', 'Email'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.slice(0, 10).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: '#1a1a2e' }}>{c.razon_social}</td>
                      <td style={{ padding: '10px 16px' }}><code style={{ background: '#F0F4FF', color: '#378ADD', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{c.cuit || '—'}</code></td>
                      <td style={{ padding: '10px 16px', color: '#666', fontSize: '12px' }}>{c.cond_iva}</td>
                      <td style={{ padding: '10px 16px', color: '#666', fontSize: '12px' }}>{c.direccion || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#666', fontSize: '12px' }}>{c.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {resultado && (
          <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
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
              <a href="/dashboard/clientes" style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}>
                Ver clientes
              </a>
              <button onClick={() => { setClientes([]); setResultado(null); setProgreso(0) }} style={{ padding: '9px 18px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>
                Importar otro archivo
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
