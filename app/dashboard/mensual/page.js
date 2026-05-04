'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import Layout from '../../../lib/layout'
import { generarInvoicePDF } from '../../../lib/invoice_pdf'

const TIPO_COLORS = { A: '#E6F1FB', B: '#FFF3CD', C: '#f5f5f5', X: '#EEEDFE', I: '#FAECE7', ND: '#FCEBEC' }
const TIPO_TEXT = { A: '#185FA5', B: '#854F0B', C: '#555', X: '#534AB7', I: '#993C1D', ND: '#A32D2D' }
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CUENTA_COLORS = [
  { bg: '#EDE9FE', color: '#5B21B6' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#DBEAFE', color: '#1D4ED8' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#E0F2FE', color: '#075985' },
  { bg: '#F0FDF4', color: '#166534' },
  { bg: '#FFF7ED', color: '#C2410C' },
]
const cuentaColorMap = {}
let cuentaColorIdx = 0
function getCuentaColor(cuenta) {
  if (!cuenta) return null
  if (!cuentaColorMap[cuenta]) {
    cuentaColorMap[cuenta] = CUENTA_COLORS[cuentaColorIdx % CUENTA_COLORS.length]
    cuentaColorIdx++
  }
  return cuentaColorMap[cuenta]
}

function primerDiaHabil(year, month) {
  let d = new Date(year, month, 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function calcTotal(items) {
  return (items || []).reduce((sum, it) => {
    const base = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
    return sum + base + base * (Number(it.alicuota_iva) / 100)
  }, 0)
}

export default function Mensual() {
  const supabase = createClient()
  const now = new Date()
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [mes, setMes] = useState(now.getMonth())
  const [anio, setAnio] = useState(now.getFullYear())
  const [comprobantes, setComprobantes] = useState([])
  const [clientes, setClientes] = useState({})
  const [sedes, setSedes] = useState({})
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [sedeFiltro, setSedeFiltro] = useState('')
  const [sedesLista, setSedesLista] = useState([])
  const [proyectando, setProyectando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [verComp, setVerComp] = useState(null)
  const [solapa, setSolapa] = useState('pendiente')
  const [exportarTodo, setExportarTodo] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUsuario(data.user)
      const { data: p } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single()
      setPerfil(p)
    })
  }, [])

  useEffect(() => { if (usuario && perfil !== undefined) cargarDatos() }, [mes, anio, usuario, perfil])

  async function cargarDatos() {
    const fechaDesde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
    const ultimoDia = new Date(anio, mes + 1, 0).getDate()
    const fechaHasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    const sedeRestringida = perfil?.sede_id || null

    let compQuery = supabase.from('comprobantes')
      .select('id, sede_id, cliente_id, tipo, fecha, recurrente, notas, estado, tc_cambio, invoice_numero, invoice_direccion, invoice_tax_id, comprobante_items(id, descripcion, cantidad, precio_neto, descuento_pct, proporcional_pct, alicuota_iva, producto_id, cuenta_contable)')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha')
    if (sedeRestringida) compQuery = compQuery.eq('sede_id', sedeRestringida)

    const [compRes, cliRes, sedRes, prodRes] = await Promise.all([
      compQuery,
      supabase.from('clientes').select('id, razon_social, cuit, cond_iva, direccion, tax_id'),
      sedeRestringida
        ? supabase.from('sedes').select('id, nombre, punto_venta').eq('id', sedeRestringida)
        : supabase.from('sedes').select('id, nombre, punto_venta'),
      supabase.from('productos').select('id, nombre, precio_neto, alicuota_iva'),
    ])

    setComprobantes(compRes.data || [])
    setClientes(Object.fromEntries((cliRes.data || []).map(c => [c.id, c])))
    setSedes(Object.fromEntries((sedRes.data || []).map(s => [s.id, s])))
    setSedesLista(sedRes.data || [])
    if (sedeRestringida) setSedeFiltro(sedeRestringida)
    setProductos(prodRes.data || [])
  }

  function cambiarMes(delta) {
    let m = mes + delta, a = anio
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMes(m); setAnio(a)
  }

  async function toggleRecurrente(id, actual) {
    await supabase.from('comprobantes').update({ recurrente: !actual }).eq('id', id)
    cargarDatos()
  }

  async function marcarFacturado(id) {
    await supabase.from('comprobantes').update({ estado: 'facturado' }).eq('id', id)
    cargarDatos()
  }

  async function marcarPendiente(id) {
    await supabase.from('comprobantes').update({ estado: 'pendiente' }).eq('id', id)
    cargarDatos()
  }

  async function eliminarComprobante(id) {
    if (!confirm('¿Eliminar este comprobante? Esta acción no se puede deshacer.')) return
    await supabase.from('comprobante_items').delete().eq('comprobante_id', id)
    await supabase.from('comprobantes').delete().eq('id', id)
    setVerComp(null)
    cargarDatos()
  }

  function handleGenerarPDF(comp) {
    const cliente = clientes[comp.cliente_id]
    const sede = sedes[comp.sede_id]
    generarInvoicePDF(comp, cliente, sede, comp.comprobante_items)
  }

  async function proyectar() {
    const recurrentes = comprobantes.filter(c => c.recurrente)
    if (!recurrentes.length) return setMensaje('No hay comprobantes marcados como recurrentes')
    setProyectando(true)
    const mesProx = mes === 11 ? 0 : mes + 1
    const anioProx = mes === 11 ? anio + 1 : anio
    const fechaProx = primerDiaHabil(anioProx, mesProx)
    const ultimoDiaProx = new Date(anioProx, mesProx + 1, 0).getDate()
    const fechaDesdeProx = `${anioProx}-${String(mesProx + 1).padStart(2, '0')}-01`
    const fechaHastaProx = `${anioProx}-${String(mesProx + 1).padStart(2, '0')}-${String(ultimoDiaProx).padStart(2, '0')}`
    const { data: existentesProx } = await supabase
      .from('comprobantes')
      .select('id, cliente_id, sede_id, tipo, comprobante_items(id, descripcion, cantidad)')
      .gte('fecha', fechaDesdeProx)
      .lte('fecha', fechaHastaProx)
    let creados = 0
    for (const comp of recurrentes) {
      const itemsOrigen = (comp.comprobante_items || []).map(it => `${it.descripcion}__${it.cantidad}`).sort().join('|')
      const yaExiste = (existentesProx || []).some(ex =>
        ex.cliente_id === comp.cliente_id && ex.sede_id === comp.sede_id && ex.tipo === comp.tipo &&
        (ex.comprobante_items || []).map(it => `${it.descripcion}__${it.cantidad}`).sort().join('|') === itemsOrigen
      )
      if (yaExiste) continue
      const tieneProporcional = (comp.comprobante_items || []).some(it => Number(it.proporcional_pct) < 100)
      const { data: nuevo, error } = await supabase.from('comprobantes').insert({
        sede_id: comp.sede_id, cliente_id: comp.cliente_id, tipo: comp.tipo, fecha: fechaProx,
        recurrente: true, estado: 'pendiente',
        notas: tieneProporcional ? `Proyectado desde ${comp.fecha} · ⚠ Tenía proporcional — verificar importe` : `Proyectado desde ${comp.fecha}`
      }).select('id').single()
      if (error || !nuevo) continue
      const itemsActualizados = (comp.comprobante_items || []).map(it => {
        const prodActual = productos.find(p => p.id === it.producto_id)
        return { comprobante_id: nuevo.id, producto_id: it.producto_id || null, descripcion: it.descripcion, cantidad: it.cantidad, precio_neto: prodActual ? prodActual.precio_neto : it.precio_neto, descuento_pct: it.descuento_pct, proporcional_pct: 100, alicuota_iva: it.alicuota_iva, cuenta_contable: it.cuenta_contable || null }
      })
      if (itemsActualizados.length > 0) await supabase.from('comprobante_items').insert(itemsActualizados)
      creados++
    }
    setProyectando(false)
    setMes(mesProx); setAnio(anioProx); setSolapa('pendiente')
    setMensaje(`✓ ${creados} comprobante${creados !== 1 ? 's' : ''} proyectado${creados !== 1 ? 's' : ''} al ${fechaProx}`)
    setTimeout(() => setMensaje(''), 5000)
  }

  async function exportarCSV() {
    const paraExportar = exportarTodo ? comprobantes : comprobantes.filter(c => c.estado === 'pendiente')
    if (!paraExportar.length) return setMensaje(exportarTodo ? 'No hay comprobantes en este mes' : 'No hay comprobantes pendientes para exportar')
    const rows = [['Fecha','Tipo Comprobante','CUIT','Razon Social','Descripcion','Precio Unitario','Cantidad','Subtotal Neto','IVA %','IVA Monto','Total','Cuenta Contable','Centro de Costo']]
    for (const comp of paraExportar) {
      const c = clientes[comp.cliente_id], s = sedes[comp.sede_id]
      for (const it of comp.comprobante_items || []) {
        const base = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
        const iva_monto = base * (Number(it.alicuota_iva) / 100)
        rows.push([comp.fecha, `Factura ${comp.tipo}`, c?.cuit || '', c?.razon_social || '', it.descripcion, Math.round(Number(it.precio_neto)), it.cantidad, Math.round(base), it.alicuota_iva, Math.round(iva_monto), Math.round(base + iva_monto), it.cuenta_contable || '', s?.nombre || ''])
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `colppy_${MESES[mes].toLowerCase()}_${anio}_${exportarTodo ? 'todas' : 'pendientes'}.csv`
    a.click(); URL.revokeObjectURL(url)
    setMensaje(`✓ CSV exportado con ${paraExportar.length} comprobante${paraExportar.length !== 1 ? 's' : ''}`)
    setTimeout(() => setMensaje(''), 4000)
  }

  const filtrados = comprobantes.filter(c => {
    const cli = clientes[c.cliente_id]
    const matchBusq = !busqueda || (cli?.razon_social || '').toLowerCase().includes(busqueda.toLowerCase()) || (cli?.cuit || '').includes(busqueda)
    const matchSede = !sedeFiltro || c.sede_id === sedeFiltro
    const matchSolapa = (c.estado || 'pendiente') === solapa
    return matchBusq && matchSede && matchSolapa
  })

  const pendientes = comprobantes.filter(c => (c.estado || 'pendiente') === 'pendiente')
  const facturados = comprobantes.filter(c => c.estado === 'facturado')
  const totalMes = comprobantes.reduce((s, c) => s + calcTotal(c.comprobante_items), 0)
  const totalPendiente = pendientes.reduce((s, c) => s + calcTotal(c.comprobante_items), 0)
  const cantRecurrentes = comprobantes.filter(c => c.recurrente).length
  const mesProxNombre = MESES[mes === 11 ? 0 : mes + 1]

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Facturación mensual</h1>
            <p style={{ color: '#888', fontSize: '13px' }}>{MESES[mes]} {anio}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>Exportar:</span>
              <button onClick={() => setExportarTodo(false)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: !exportarTodo ? '#FFF3CD' : 'transparent', color: !exportarTodo ? '#854F0B' : '#888' }}>Pendientes</button>
              <button onClick={() => setExportarTodo(true)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: exportarTodo ? '#E6F1FB' : 'transparent', color: exportarTodo ? '#185FA5' : '#888' }}>Todas</button>
            </div>
            <button onClick={exportarCSV} style={{ padding: '9px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555', fontWeight: '500' }}>↓ Exportar CSV Colppy</button>
            <button onClick={proyectar} disabled={proyectando} style={{ padding: '9px 18px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {proyectando ? 'Proyectando...' : `Proyectar a ${mesProxNombre} →`}
            </button>
          </div>
        </div>

        {mensaje && (
          <div style={{ background: mensaje.startsWith('✓') ? '#E8F5E9' : '#FFF3CD', color: mensaje.startsWith('✓') ? '#2E7D32' : '#856404', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
            {mensaje}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total del mes', value: formatMoney(totalMes), sub: `${comprobantes.length} comprobantes`, color: '#378ADD' },
            { label: 'Pendientes', value: pendientes.length, sub: formatMoney(totalPendiente), color: '#854F0B', bg: '#FFF3CD' },
            { label: 'Facturados', value: facturados.length, sub: formatMoney(facturados.reduce((s,c) => s + calcTotal(c.comprobante_items), 0)), color: '#2E7D32', bg: '#E8F5E9' },
            { label: 'Próximo mes', value: mesProxNombre, sub: primerDiaHabil(mes === 11 ? anio + 1 : anio, mes === 11 ? 0 : mes + 1), color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg || 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Solapas */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e8e8e8', marginBottom: '0' }}>
          {[
            { key: 'pendiente', label: 'Pendientes de facturar', count: pendientes.length, color: '#854F0B', bg: '#FFF3CD', activeBorder: '#F59E0B' },
            { key: 'facturado', label: 'Facturados', count: facturados.length, color: '#2E7D32', bg: '#E8F5E9', activeBorder: '#27ae60' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setSolapa(tab.key)} style={{
              padding: '12px 24px', border: 'none',
              borderBottom: solapa === tab.key ? `3px solid ${tab.activeBorder}` : '3px solid transparent',
              background: 'white', cursor: 'pointer', fontSize: '13px',
              fontWeight: solapa === tab.key ? '700' : '500',
              color: solapa === tab.key ? tab.color : '#888',
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-2px',
            }}>
              {tab.label}
              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: solapa === tab.key ? tab.bg : '#f5f5f5', color: solapa === tab.key ? tab.color : '#888' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
          <button onClick={() => cambiarMes(-1)} style={{ padding: '7px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>‹ Anterior</button>
          <strong style={{ fontSize: '15px', color: '#1a1a2e' }}>{MESES[mes]} {anio}</strong>
          <button onClick={() => cambiarMes(1)} style={{ padding: '7px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>Siguiente ›</button>
          <input placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', width: '200px', color: '#333' }} />
          <select value={sedeFiltro} onChange={e => setSedeFiltro(e.target.value)} style={{ padding: '7px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', background: 'white', color: '#555' }}>
            <option value="">Todas las sedes</option>
            {sedesLista.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '0 12px 12px 12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                {['Fecha', 'Cliente', 'Sede', 'Tipo', 'Cuenta contable', 'Ítems', 'Total', 'Recurrente', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>
                    {solapa === 'pendiente' ? '✓ No hay comprobantes pendientes de facturar' : 'No hay comprobantes facturados en este período'}
                  </td>
                </tr>
              )}
              {filtrados.map(comp => {
                const cli = clientes[comp.cliente_id]
                const sede = sedes[comp.sede_id]
                const total = calcTotal(comp.comprobante_items)
                const itemsLabel = (comp.comprobante_items || []).map(it => `${it.cantidad}x ${it.descripcion}`).join(', ')
                const tieneProp = (comp.comprobante_items || []).some(it => Number(it.proporcional_pct) < 100)
                const cuentas = [...new Set((comp.comprobante_items || []).map(it => it.cuenta_contable).filter(Boolean))]
                return (
                  <tr key={comp.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>{comp.fecha}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#1a1a2e' }}>{cli?.razon_social || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{cli?.cuit}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#EEF2FF', color: '#3730A3', whiteSpace: 'nowrap' }}>
                        {sede?.nombre || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: TIPO_COLORS[comp.tipo], color: TIPO_TEXT[comp.tipo] }}>
                        {comp.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {cuentas.length === 0
                          ? <span style={{ color: '#ddd', fontSize: '12px' }}>—</span>
                          : cuentas.map(c => {
                              const col = getCuentaColor(c)
                              return <span key={c} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: col.bg, color: col.color, whiteSpace: 'nowrap' }}>{c}</span>
                            })
                        }
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', maxWidth: '180px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666' }}>{itemsLabel || '—'}</div>
                      {tieneProp && <span style={{ background: '#FFF3CD', color: '#854F0B', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>⚠ Prop.</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1a1a2e', whiteSpace: 'nowrap' }}>{formatMoney(total)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleRecurrente(comp.id, comp.recurrente)}
                        title={comp.recurrente ? 'Quitar recurrencia' : 'Marcar como recurrente'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 10px', border: `1px solid ${comp.recurrente ? '#BBF7D0' : '#e0e0e0'}`,
                          borderRadius: '20px', background: comp.recurrente ? '#DCFCE7' : '#fafafa',
                          cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                          color: comp.recurrente ? '#15803D' : '#aaa', transition: 'all .15s'
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>{comp.recurrente ? '↻' : '↻'}</span>
                        {comp.recurrente ? 'Recurrente' : 'Una vez'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setVerComp(comp)} style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555', marginRight: '6px' }}>Ver</button>
                      {solapa === 'pendiente'
                        ? <button onClick={() => marcarFacturado(comp.id)} style={{ padding: '5px 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#374151', fontWeight: '500' }}>Marcar facturado</button>
                        : <button onClick={() => marcarPendiente(comp.id)} style={{ padding: '5px 12px', border: '1px solid #FFE0B2', borderRadius: '6px', background: '#FFF8F1', cursor: 'pointer', fontSize: '12px', color: '#E65100', fontWeight: '600' }}>↩ Pendiente</button>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      {verComp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVerComp(null)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '720px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>{clientes[verComp.cliente_id]?.razon_social || '—'}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{clientes[verComp.cliente_id]?.cuit}</span>
                  <span>·</span>
                  <span style={{ padding: '1px 8px', borderRadius: '20px', background: '#EEF2FF', color: '#3730A3', fontWeight: '700', fontSize: '11px' }}>{sedes[verComp.sede_id]?.nombre}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: (verComp.estado || 'pendiente') === 'pendiente' ? '#FFF3CD' : '#E8F5E9', color: (verComp.estado || 'pendiente') === 'pendiente' ? '#854F0B' : '#2E7D32' }}>
                  {(verComp.estado || 'pendiente') === 'pendiente' ? 'Pendiente' : '✓ Facturado'}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: TIPO_COLORS[verComp.tipo], color: TIPO_TEXT[verComp.tipo] }}>{verComp.tipo}</span>
                <span style={{ fontSize: '13px', color: '#888' }}>{verComp.fecha}</span>
                <button onClick={() => setVerComp(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '22px', color: '#aaa', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            </div>

            {/* Tabla items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #f0f0f0' }}>
                  {['Descripción', 'Cuenta contable', 'Cant.', 'Precio neto', 'Dto %', 'Prop %', 'IVA', 'Subtotal'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '600', fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(verComp.comprobante_items || []).length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#bbb' }}>Sin ítems</td></tr>
                )}
                {(verComp.comprobante_items || []).map((it, i) => {
                  const base = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
                  const col = getCuentaColor(it.cuenta_contable)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px', fontWeight: '500', color: '#1a1a2e' }}>{it.descripcion}</td>
                      <td style={{ padding: '10px' }}>
                        {it.cuenta_contable
                          ? <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: col.bg, color: col.color }}>{it.cuenta_contable}</span>
                          : <span style={{ color: '#ddd' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '10px', color: '#555' }}>{it.cantidad}</td>
                      <td style={{ padding: '10px', color: '#555' }}>{formatMoney(Number(it.precio_neto))}</td>
                      <td style={{ padding: '10px', color: '#555' }}>{it.descuento_pct}%</td>
                      <td style={{ padding: '10px', color: Number(it.proporcional_pct) < 100 ? '#854F0B' : '#555', fontWeight: Number(it.proporcional_pct) < 100 ? '600' : '400' }}>{it.proporcional_pct}%</td>
                      <td style={{ padding: '10px', color: '#555' }}>{it.alicuota_iva}%</td>
                      <td style={{ padding: '10px', fontWeight: '700', color: '#1a1a2e' }}>{formatMoney(base)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totales */}
            <div style={{ background: '#F8FAFF', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', border: '1px solid #e8eef8' }}>
              {(() => {
                const items = verComp.comprobante_items || []
                const neto = items.reduce((s, it) => s + Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100), 0)
                const iva = items.reduce((s, it) => { const b = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100); return s + b * (Number(it.alicuota_iva) / 100) }, 0)
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '4px' }}><span>Subtotal neto</span><span>{formatMoney(neto)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginBottom: '8px' }}><span>IVA</span><span>{formatMoney(iva)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', color: '#1a1a2e', borderTop: '1px solid #dde6f5', paddingTop: '8px' }}><span>Total</span><span style={{ color: '#378ADD' }}>{formatMoney(neto + iva)}</span></div>
                  </>
                )
              })()}
            </div>

            {verComp.notas && (
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', fontStyle: 'italic' }}>Nota: {verComp.notas}</div>
            )}

            {/* Acciones modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => eliminarComprobante(verComp.id)} style={{ padding: '8px 16px', border: '1px solid #FFCDD2', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#C62828' }}>
                Eliminar
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {verComp.tipo === 'I' && (
                  <button onClick={() => handleGenerarPDF(verComp)} style={{ padding: '8px 16px', border: '1px solid #1a1a2e', borderRadius: '8px', background: '#1a1a2e', cursor: 'pointer', fontSize: '13px', color: 'white', fontWeight: '600' }}>
                    📄 Imprimir PDF Invoice #{verComp.invoice_numero}
                  </button>
                )}
                {(verComp.estado || 'pendiente') === 'pendiente'
                  ? <button onClick={() => { marcarFacturado(verComp.id); setVerComp(null) }} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Marcar facturado</button>
                  : <button onClick={() => { marcarPendiente(verComp.id); setVerComp(null) }} style={{ padding: '8px 16px', border: '1px solid #FFE0B2', borderRadius: '8px', background: '#FFF8F1', cursor: 'pointer', fontSize: '13px', color: '#E65100', fontWeight: '600' }}>↩ Volver a pendiente</button>
                }
                <button onClick={() => setVerComp(null)} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#555' }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}
