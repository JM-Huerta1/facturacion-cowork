'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Layout from '../../../lib/layout'

const COND_IVA = { RI: 'Resp. Inscripto', MT: 'Monotributista', CF: 'Consumidor Final', EX: 'Exento', X: 'Sin condición', I: 'Exterior' }
const TIPO_AUTO = { RI: 'A', MT: 'C', CF: 'B', EX: 'C', X: 'X', I: 'I' }

export default function Clientes() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ razon_social: '', cuit: '', cond_iva: 'RI', email: '', contacto: '', direccion: '', tax_id: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
    cargarClientes()
  }, [])

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('*').order('razon_social')
    setClientes(data || [])
  }

  function abrirNuevo() {
    setForm({ razon_social: '', cuit: '', cond_iva: 'RI', email: '', contacto: '', direccion: '', tax_id: '' })
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(c) {
    setForm({ razon_social: c.razon_social, cuit: c.cuit, cond_iva: c.cond_iva, email: c.email || '', contacto: c.contacto || '', direccion: c.direccion || '', tax_id: c.tax_id || '' })
    setEditando(c.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.razon_social || !form.cuit) return alert('Razón social y CUIT son obligatorios')
    setLoading(true)
    if (editando) {
      await supabase.from('clientes').update(form).eq('id', editando)
    } else {
      await supabase.from('clientes').insert(form)
    }
    setLoading(false)
    setMostrarForm(false)
    cargarClientes()
  }

  async function toggleActivo(c) {
    await supabase.from('clientes').update({ active: !c.active }).eq('id', c.id)
    cargarClientes()
  }

  const filtrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cuit.includes(busqueda)
  )

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: '#333', background: '#fff' }
  const labelStyle = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Clientes</h1>
            <p style={{ color: '#888', fontSize: '13px' }}>{clientes.filter(c => c.active).length} clientes activos</p>
          </div>
          <button onClick={abrirNuevo} style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Nuevo cliente</button>
        </div>

        <input placeholder="Buscar por razón social o CUIT..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...inputStyle, width: '300px', marginBottom: '16px' }} />

        {mostrarForm && (
          <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '20px' }}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Razón social / Nombre *</label>
                <input style={inputStyle} value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })} placeholder="Tech Solutions SRL" />
              </div>
              <div>
                <label style={labelStyle}>CUIT *</label>
                <input style={inputStyle} value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} placeholder="30-71234567-8" />
              </div>
              <div>
                <label style={labelStyle}>Condición IVA</label>
                <select style={inputStyle} value={form.cond_iva} onChange={e => setForm({ ...form, cond_iva: e.target.value })}>
                  {Object.entries(COND_IVA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Email de facturación</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@empresa.com" />
              </div>
              <div>
                <label style={labelStyle}>Contacto / responsable</label>
                <input style={inputStyle} value={form.contacto} onChange={e => setForm({ ...form, contacto: e.target.value })} placeholder="Nombre del responsable" />
                {form.cond_iva === 'I' && (
  <>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Dirección fiscal</label>
                <input style={inputStyle} value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="16192 Coastal Highway, City of Lewes..." />
             </div>
             <div>
               <label style={labelStyle}>Tax ID</label>
               <input style={inputStyle} value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} placeholder="516535531" />
            </div>
  </>)}
              </div>
              <div style={{ gridColumn: '1/-1', background: '#F0F4FF', borderRadius: '8px', padding: '10px 14px' }}>
                <span style={{ fontSize: '13px', color: '#555' }}>Tipo de comprobante automático: </span>
                <strong style={{ color: '#378ADD' }}>Factura {TIPO_AUTO[form.cond_iva]}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
              <button onClick={() => setMostrarForm(false)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>Cancelar</button>
              <button onClick={guardar} disabled={loading} style={{ padding: '8px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{loading ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                {['Razón social', 'CUIT', 'Cond. IVA', 'Tipo', 'Email', 'Contacto', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>No hay clientes{busqueda ? ' con ese criterio' : ' cargados todavía'}</td></tr>
              )}
              {filtrados.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1a1a2e' }}>{c.razon_social}</td>
                  <td style={{ padding: '12px 16px' }}><code style={{ background: '#F0F4FF', color: '#378ADD', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{c.cuit}</code></td>
                  <td style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>{COND_IVA[c.cond_iva]}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#E6F1FB', color: '#185FA5' }}>{TIPO_AUTO[c.cond_iva]}</span></td>
                  <td style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>{c.email || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>{c.contacto || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: c.active ? '#E8F5E9' : '#FFEBEE', color: c.active ? '#2E7D32' : '#C62828' }}>
                      {c.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => abrirEditar(c)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555', marginRight: '6px' }}>Editar</button>
                    <button onClick={() => toggleActivo(c)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: c.active ? '#C62828' : '#2E7D32' }}>{c.active ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}