'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Layout from '../../../lib/layout'

export default function Sedes() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [sedes, setSedes] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', punto_venta: '', direccion: '', email: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
    cargarSedes()
  }, [])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('*').order('nombre')
    setSedes(data || [])
  }

  function abrirNueva() {
    setForm({ nombre: '', punto_venta: '', direccion: '', email: '' })
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(sede) {
    setForm({ nombre: sede.nombre, punto_venta: sede.punto_venta, direccion: sede.direccion || '', email: sede.email || '' })
    setEditando(sede.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.nombre || !form.punto_venta) return alert('Nombre y punto de venta son obligatorios')
    setLoading(true)
    if (editando) {
      await supabase.from('sedes').update(form).eq('id', editando)
    } else {
      await supabase.from('sedes').insert(form)
    }
    setLoading(false)
    setMostrarForm(false)
    cargarSedes()
  }

  async function toggleActivo(sede) {
    await supabase.from('sedes').update({ active: !sede.active }).eq('id', sede.id)
    cargarSedes()
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: '#333', background: '#fff' }
  const labelStyle = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Sedes</h1>
            <p style={{ color: '#888', fontSize: '13px' }}>{sedes.length} sede{sedes.length !== 1 ? 's' : ''} registrada{sedes.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={abrirNueva} style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Nueva sede</button>
        </div>

        {mostrarForm && (
          <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '20px' }}>{editando ? 'Editar sede' : 'Nueva sede'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Nombre de la sede *</label>
                <input style={inputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Sede Centro" />
              </div>
              <div>
                <label style={labelStyle}>Punto de venta *</label>
                <input style={inputStyle} value={form.punto_venta} onChange={e => setForm({ ...form, punto_venta: e.target.value })} placeholder="0001" maxLength={4} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sede@cowork.com" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Dirección</label>
                <input style={inputStyle} value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Colón 123" />
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
                {['Nombre', 'Punto de venta', 'Email', 'Dirección', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sedes.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>No hay sedes cargadas todavía</td></tr>
              )}
              {sedes.map(sede => (
                <tr key={sede.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1a1a2e' }}>{sede.nombre}</td>
                  <td style={{ padding: '12px 16px' }}><code style={{ background: '#F0F4FF', color: '#378ADD', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{sede.punto_venta}</code></td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{sede.email || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{sede.direccion || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: sede.active ? '#E8F5E9' : '#FFEBEE', color: sede.active ? '#2E7D32' : '#C62828' }}>
                      {sede.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button onClick={() => abrirEditar(sede)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555', marginRight: '6px' }}>Editar</button>
                    <button onClick={() => toggleActivo(sede)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: sede.active ? '#C62828' : '#2E7D32' }}>{sede.active ? 'Desactivar' : 'Activar'}</button>
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