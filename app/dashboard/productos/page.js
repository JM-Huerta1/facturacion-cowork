'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Layout from '../../../lib/layout'

export default function Productos() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [productos, setProductos] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', precio_neto: '', alicuota_iva: '21', cuenta_contable: '' })
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
    cargarProductos()
    supabase.from('sedes').select('id, nombre').then(({ data }) => setSedes(data || []))
  }, [])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setProductos(data || [])
  }

  function nombreSede(sede_ids) {
    if (!sede_ids || sede_ids.length === 0) return 'Todas las sedes'
    return sede_ids.map(id => sedes.find(s => s.id === id)?.nombre || id).join(', ')
  }

  function abrirNuevo() {
    setForm({ codigo: '', nombre: '', precio_neto: '', alicuota_iva: '21', cuenta_contable: '' })
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(p) {
    setForm({ codigo: p.codigo, nombre: p.nombre, precio_neto: String(p.precio_neto), alicuota_iva: String(p.alicuota_iva), cuenta_contable: p.cuenta_contable || '' })
    setEditando(p.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.codigo || !form.nombre || !form.precio_neto) return alert('Código, nombre y precio son obligatorios')
    setLoading(true)
    const data = { ...form, precio_neto: parseFloat(form.precio_neto), alicuota_iva: parseFloat(form.alicuota_iva) }
    if (editando) {
      await supabase.from('productos').update(data).eq('id', editando)
    } else {
      await supabase.from('productos').insert(data)
    }
    setLoading(false)
    setMostrarForm(false)
    cargarProductos()
  }

  async function toggleActivo(p) {
    await supabase.from('productos').update({ active: !p.active }).eq('id', p.id)
    cargarProductos()
  }

  function formatMoney(n) {
    return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: '#333', background: '#fff' }
  const labelStyle = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Productos</h1>
            <p style={{ color: '#888', fontSize: '13px' }}>{productos.filter(p => p.active).length} productos activos</p>
          </div>
          <button onClick={abrirNuevo} style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Nuevo producto</button>
        </div>

        {mostrarForm && (
          <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '20px' }}>{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Código *</label>
                <input style={inputStyle} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="OF-PRIV-001" />
              </div>
              <div>
                <label style={labelStyle}>Alícuota IVA</label>
                <select style={inputStyle} value={form.alicuota_iva} onChange={e => setForm({ ...form, alicuota_iva: e.target.value })}>
                  <option value="21">21%</option>
                  <option value="10.5">10.5%</option>
                  <option value="27">27%</option>
                  <option value="0">0% (exento)</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Descripción *</label>
                <input style={inputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Oficina privada 4 puestos" />
              </div>
              <div>
                <label style={labelStyle}>Precio neto (sin IVA) *</label>
                <input style={inputStyle} type="number" value={form.precio_neto} onChange={e => setForm({ ...form, precio_neto: e.target.value })} placeholder="180000" />
              </div>
              <div>
                <label style={labelStyle}>Cuenta contable (Colppy)</label>
                <input style={inputStyle} value={form.cuenta_contable} onChange={e => setForm({ ...form, cuenta_contable: e.target.value })} placeholder="Opcional" />
              </div>
              {form.precio_neto && (
                <div style={{ gridColumn: '1/-1', background: '#F0F4FF', borderRadius: '8px', padding: '10px 14px' }}>
                  <span style={{ fontSize: '13px', color: '#555' }}>Precio final con IVA: </span>
                  <strong style={{ color: '#378ADD', fontSize: '15px' }}>{formatMoney(parseFloat(form.precio_neto || 0) * (1 + parseFloat(form.alicuota_iva) / 100))}</strong>
                </div>
              )}
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
                {['Código', 'Descripción', 'Precio neto', 'IVA', 'Precio final', 'Cuenta contable', 'Nombre cuenta contable', 'Sede', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 && (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>No hay productos cargados todavía</td></tr>
              )}
              {productos.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 16px' }}><code style={{ background: '#F0F4FF', color: '#378ADD', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{p.codigo}</code></td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1a1a2e' }}>{p.nombre}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#555' }}>{formatMoney(p.precio_neto)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#F0F4FF', color: '#378ADD' }}>{p.alicuota_iva}%</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#1a1a2e' }}>{formatMoney(p.precio_neto * (1 + p.alicuota_iva / 100))}</td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: '12px' }}>{p.cuenta_contable || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: '12px' }}>{p.nombre_cuenta_contable || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>{nombreSede(p.sede_ids)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: p.active ? '#E8F5E9' : '#FFEBEE', color: p.active ? '#2E7D32' : '#C62828' }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => abrirEditar(p)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555', marginRight: '6px' }}>Editar</button>
                    <button onClick={() => toggleActivo(p)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: p.active ? '#C62828' : '#2E7D32' }}>{p.active ? 'Desactivar' : 'Activar'}</button>
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