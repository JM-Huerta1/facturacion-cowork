'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Layout from '../../../lib/layout'

const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin central',
  OFFICE_MANAGER: 'Office Manager',
  FRONT_DESK: 'Front Desk',
}

const ROL_COLORS = {
  SUPER_ADMIN: { bg: '#EDE9FE', color: '#5B21B6' },
  ADMIN: { bg: '#E6F1FB', color: '#185FA5' },
  OFFICE_MANAGER: { bg: '#E8F5E9', color: '#2E7D32' },
  FRONT_DESK: { bg: '#FFF3CD', color: '#854F0B' },
}

export default function Usuarios() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [sedes, setSedes] = useState([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ rol: 'FRONT_DESK', sede_id: '', active: true })
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUsuario(data.user)
    })
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const [uRes, sRes] = await Promise.all([
      supabase.from('usuarios').select('*').order('email'),
      supabase.from('sedes').select('*').eq('active', true).order('nombre'),
    ])
    setUsuarios(uRes.data || [])
    setSedes(sRes.data || [])
  }

  function abrirEditar(u) {
    setEditando(u.id)
    setForm({ rol: u.rol, sede_id: u.sede_id || '', active: u.active })
  }

  function cancelarEditar() {
    setEditando(null)
    setForm({ rol: 'FRONT_DESK', sede_id: '', active: true })
  }

  async function guardar(id) {
    setLoading(true)
    const { error } = await supabase
      .from('usuarios')
      .update({
        rol: form.rol,
        sede_id: form.sede_id || null,
        active: form.active,
      })
      .eq('id', id)

    if (error) {
      setMensaje('Error al guardar: ' + error.message)
    } else {
      setMensaje('✓ Usuario actualizado correctamente')
      setEditando(null)
      cargarDatos()
    }
    setLoading(false)
    setTimeout(() => setMensaje(''), 3000)
  }

  const inputStyle = { padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#333' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Gestión de usuarios</h1>
          <p style={{ color: '#888', fontSize: '13px' }}>Asigná roles y sedes a cada usuario del sistema</p>
        </div>

        {mensaje && (
          <div style={{ background: mensaje.startsWith('✓') ? '#E8F5E9' : '#FFEBEE', color: mensaje.startsWith('✓') ? '#2E7D32' : '#C62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
            {mensaje}
          </div>
        )}

        {/* Info de roles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { rol: 'SUPER_ADMIN', desc: 'Acceso total al sistema' },
            { rol: 'ADMIN', desc: 'Todas las sedes, exporta CSV' },
            { rol: 'OFFICE_MANAGER', desc: 'Su sede, puede proyectar' },
            { rol: 'FRONT_DESK', desc: 'Su sede, solo carga facturas' },
          ].map(r => (
            <div key={r.rol} style={{ background: ROL_COLORS[r.rol].bg, borderRadius: '10px', padding: '14px 16px', border: `1px solid ${ROL_COLORS[r.rol].color}22` }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: ROL_COLORS[r.rol].color, marginBottom: '4px' }}>{ROLES[r.rol]}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{r.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                {['Usuario', 'Email', 'Rol', 'Sede asignada', 'Estado', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#bbb' }}>No hay usuarios registrados todavía</td></tr>
              )}
              {usuarios.map(u => {
                const sede = sedes.find(s => s.id === u.sede_id)
                const esEditando = editando === u.id
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f5', background: esEditando ? '#FAFBFF' : 'white' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                          {(u.nombre || u.email || 'U')[0].toUpperCase()}
                        </div>
                        <div style={{ fontWeight: '600', color: '#1a1a2e', fontSize: '13px' }}>{u.nombre || '—'}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {esEditando ? (
                        <select
                          style={inputStyle}
                          value={form.rol}
                          onChange={e => setForm({ ...form, rol: e.target.value })}
                        >
                          {Object.entries(ROLES).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: ROL_COLORS[u.rol]?.bg || '#f5f5f5', color: ROL_COLORS[u.rol]?.color || '#555' }}>
                          {ROLES[u.rol] || u.rol}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {esEditando ? (
                        <select
                          style={inputStyle}
                          value={form.sede_id}
                          onChange={e => setForm({ ...form, sede_id: e.target.value })}
                        >
                          <option value="">— Sin sede (Admin) —</option>
                          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      ) : (
                        <span style={{ color: sede ? '#1a1a2e' : '#aaa', fontSize: '13px' }}>
                          {sede ? sede.nombre : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {esEditando ? (
                        <button
                          onClick={() => setForm({ ...form, active: !form.active })}
                          style={{ padding: '4px 12px', border: `1px solid ${form.active ? '#C8E6C9' : '#FFCDD2'}`, borderRadius: '20px', background: form.active ? '#E8F5E9' : '#FFEBEE', color: form.active ? '#2E7D32' : '#C62828', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          {form.active ? 'Activo' : 'Inactivo'}
                        </button>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: u.active ? '#E8F5E9' : '#FFEBEE', color: u.active ? '#2E7D32' : '#C62828' }}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {esEditando ? (
                        <>
                          <button onClick={cancelarEditar} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555', marginRight: '6px' }}>Cancelar</button>
                          <button onClick={() => guardar(u.id)} disabled={loading} style={{ padding: '5px 12px', border: 'none', borderRadius: '6px', background: '#378ADD', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            {loading ? 'Guardando...' : 'Guardar'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => abrirEditar(u)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555' }}>Editar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px', padding: '16px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #e8eef8' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#378ADD', marginBottom: '8px' }}>¿Cómo agregar un usuario nuevo?</div>
          <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
            1. El usuario tiene que ingresar al sistema en <strong>facturacion-cowork.vercel.app</strong> y hacer login con Google.<br/>
            2. Una vez que ingresó, aparece acá en esta lista.<br/>
            3. Asignale el rol y la sede correspondiente haciendo click en "Editar".
          </div>
        </div>
      </div>
    </Layout>
  )
}