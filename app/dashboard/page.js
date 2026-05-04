'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Layout from '../../lib/layout'
import { generarInvoicePDF } from '../../lib/invoice_pdf'

const TIPO_AUTO = { RI: 'A', MT: 'C', CF: 'B', EX: 'C', X: 'X', I: 'I' }
const TIPOS = ['A', 'B', 'C', 'X', 'I', 'ND']

export default function FacturaIndividual() {
  const supabase = createClient()
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [sedes, setSedes] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [sede_id, setSedeId] = useState('')
  const [cliente_id, setClienteId] = useState('')
  const [tipo, setTipo] = useState('A')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([{ prod_id: '', descripcion: '', cantidad: 1, precio_neto: 0, descuento_pct: 0, proporcional_pct: 100, alicuota_iva: 21 }])
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(null) // comprobante guardado
  const [tcBNA, setTcBNA] = useState('')
  const [tcCargando, setTcCargando] = useState(false)
  const [conIva, setConIva] = useState(true)
  // Campos extra para invoice I
  const [invoiceDireccion, setInvoiceDireccion] = useState('')
  const [invoiceTaxId, setInvoiceTaxId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUsuario(data.user)
    })
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!sede_id) return
    cargarProductos(sede_id)
  }, [sede_id])

  async function cargarDatos() {
    const [s, c] = await Promise.all([
      supabase.from('sedes').select('*').eq('active', true).order('nombre'),
      supabase.from('clientes').select('*').eq('active', true).order('razon_social'),
    ])
    setSedes(s.data || [])
    setClientes(c.data || [])
    if (s.data?.length) setSedeId(s.data[0].id)
  }

  async function cargarProductos(sedeId) {
    const { data } = await supabase.from('productos').select('*').eq('active', true)
      .or(`sede_ids.is.null,sede_ids.cs.{${sedeId}}`).order('nombre')
    setProductos(data || [])
  }

  async function cargarTipoCambio() {
    setTcCargando(true)
    try {
      const res = await fetch('https://api.bluelytics.com.ar/v2/latest')
      const data = await res.json()
      const compra = data?.oficial?.value_buy
      if (compra) setTcBNA(String(Math.round(compra)))
    } catch (e) {
      console.error('No se pudo obtener TC BNA', e)
    }
    setTcCargando(false)
  }

  function onClienteChange(id) {
    setClienteId(id)
    const c = clientes.find(x => x.id === id)
    if (!c) return
    const tipoAuto = TIPO_AUTO[c.cond_iva] || 'B'
    setTipo(tipoAuto)
    if (tipoAuto === 'I') {
      if (!tcBNA) cargarTipoCambio()
      // Pre-cargar dirección y tax_id si existen
      setInvoiceDireccion(c.direccion || '')
      setInvoiceTaxId(c.tax_id || '')
    }
  }

  function onTipoChange(t) {
    setTipo(t)
if (t === 'I') {
      if (!tcBNA) cargarTipoCambio()
      const c = clientes.find(x => x.id === cliente_id)
      if (c) {
        setInvoiceDireccion(c.direccion || '')
        setInvoiceTaxId(c.tax_id || '')
      }
    }
  }

  function onProductoChange(i, prod_id) {
    const p = productos.find(x => x.id === prod_id)
    const newItems = [...items]
    newItems[i] = { ...newItems[i], prod_id, descripcion: p?.nombre || '', precio_neto: p?.precio_neto || 0, alicuota_iva: p?.alicuota_iva || 21 }
    setItems(newItems)
  }

  function updItem(i, key, val) {
    const newItems = [...items]
    newItems[i][key] = val
    setItems(newItems)
  }

  function addItem() {
    setItems([...items, { prod_id: '', descripcion: '', cantidad: 1, precio_neto: 0, descuento_pct: 0, proporcional_pct: 100, alicuota_iva: 21 }])
  }

  function removeItem(i) {
    if (items.length === 1) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function calcSubtotal(it) {
    return Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
  }

  const neto = items.reduce((s, it) => s + calcSubtotal(it), 0)
  const iva = conIva ? items.reduce((s, it) => s + calcSubtotal(it) * (Number(it.alicuota_iva) / 100), 0) : 0
  const total = neto + iva

  function formatMoney(n) {
    return '$' + Math.round(n).toLocaleString('es-AR')
  }

  async function guardar() {
    if (!cliente_id) return alert('Seleccioná un cliente')
    if (items.some(it => !it.descripcion || it.precio_neto <= 0)) return alert('Completá todos los ítems')
    if (tipo === 'I' && !tcBNA) return alert('Ingresá el tipo de cambio para factura I')
    if (tipo === 'I' && !invoiceTaxId) return alert('Ingresá el Tax ID del cliente')
    if (tipo === 'I' && !invoiceDireccion) return alert('Ingresá la dirección del cliente')
    setGuardando(true)

    const esUSD = tipo === 'I' && tcBNA
    const tc = Number(tcBNA) || 1

    // Obtener próximo número de invoice
    let invoiceNumero = null
    if (tipo === 'I') {
      const { data: lastInvoice } = await supabase
        .from('comprobantes')
        .select('invoice_numero')
        .eq('tipo', 'I')
        .not('invoice_numero', 'is', null)
        .order('invoice_numero', { ascending: false })
        .limit(1)
        .maybeSingle()
      invoiceNumero = lastInvoice ? lastInvoice.invoice_numero + 1 : 1000
    }

    const { data: comp, error: errorComp } = await supabase
      .from('comprobantes')
      .insert({
        sede_id,
        cliente_id,
        tipo,
        fecha,
        notas,
        recurrente: false,
        estado: 'pendiente',
        tc_cambio: esUSD ? tc : null,
        invoice_numero: invoiceNumero,
        invoice_direccion: tipo === 'I' ? invoiceDireccion : null,
        invoice_tax_id: tipo === 'I' ? invoiceTaxId : null,
      })
      .select('id, invoice_numero, fecha, tc_cambio, invoice_direccion, invoice_tax_id, notas, tipo, estado')
      .single()

    if (errorComp || !comp) {
      alert('Error al guardar el comprobante: ' + (errorComp?.message || 'desconocido'))
      setGuardando(false)
      return
    }

    const itemsParaGuardar = items.map(it => ({
      comprobante_id: comp.id,
      producto_id: it.prod_id && it.prod_id !== '_custom' ? it.prod_id : null,
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad),
      precio_neto: esUSD
        ? Number((Number(it.precio_neto) / tc).toFixed(2))
        : Number(it.precio_neto),
      descuento_pct: Number(it.descuento_pct || 0),
      proporcional_pct: Number(it.proporcional_pct || 100),
      alicuota_iva: conIva ? Number(it.alicuota_iva || 21) : 0,
    }))

    const { error: errorItems } = await supabase
      .from('comprobante_items')
      .insert(itemsParaGuardar)

    if (errorItems) {
      alert('Error al guardar los ítems: ' + errorItems.message)
      await supabase.from('comprobantes').delete().eq('id', comp.id)
      setGuardando(false)
      return
    }

    setGuardando(false)
    setGuardado({ ...comp, comprobante_items: itemsParaGuardar })
  }

  function handleGenerarPDF() {
    if (!guardado) return
    const cliente = clientes.find(c => c.id === cliente_id)
    const sede = sedes.find(s => s.id === sede_id)
    generarInvoicePDF(guardado, cliente, sede, guardado.comprobante_items)
  }

  function limpiarFormulario() {
    setGuardado(null)
    setItems([{ prod_id: '', descripcion: '', cantidad: 1, precio_neto: 0, descuento_pct: 0, proporcional_pct: 100, alicuota_iva: 21 }])
    setClienteId('')
    setNotas('')
    setTcBNA('')
    setConIva(true)
    setInvoiceDireccion('')
    setInvoiceTaxId('')
    setTipo('A')
  }

  const inputStyle = { padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box', color: '#333', background: '#fff' }
  const labelStyle = { fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px', fontWeight: '500' }

  if (!usuario) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>Cargando...</div>

  return (
    <Layout usuario={usuario}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>Factura individual</h1>
          <p style={{ color: '#888', fontSize: '13px' }}>Completá los datos y guardá el comprobante</p>
        </div>

        {/* Banner de éxito con botón PDF */}
        {guardado && (
          <div style={{ background: '#E8F5E9', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#2E7D32', marginBottom: '4px' }}>
                ✓ Factura guardada correctamente
              </div>
              {guardado.tipo === 'I' && (
                <div style={{ fontSize: '13px', color: '#555' }}>
                  Invoice #{guardado.invoice_numero} — listo para generar PDF
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {guardado.tipo === 'I' && (
                <button
                  onClick={handleGenerarPDF}
                  style={{ padding: '10px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📄 Generar PDF Invoice #{guardado.invoice_numero}
                </button>
              )}
              <button
                onClick={limpiarFormulario}
                style={{ padding: '10px 20px', background: '#378ADD', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                + Nueva factura
              </button>
            </div>
          </div>
        )}

        {/* Datos del comprobante */}
        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '20px' }}>Datos del comprobante</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Sede</label>
              <select style={inputStyle} value={sede_id} onChange={e => setSedeId(e.target.value)}>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cliente</label>
              <select style={inputStyle} value={cliente_id} onChange={e => onClienteChange(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} · {c.cuit}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo de comprobante</label>
              <select style={inputStyle} value={tipo} onChange={e => onTipoChange(e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>Factura {t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div style={{ gridColumn: '2/-1' }}>
              <label style={labelStyle}>Notas internas</label>
              <input style={inputStyle} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Referencia, aclaración..." />
            </div>

            {/* Campos Invoice I */}
            {tipo === 'I' && (
              <div style={{ gridColumn: '1/-1', background: '#F0F4FF', borderRadius: '10px', padding: '20px', border: '1px solid #d0e4f7' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#378ADD', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '16px' }}>
                  Invoice en USD — Datos del cliente
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ ...labelStyle, color: '#378ADD' }}>TC Banco Nación compra</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        style={{ ...inputStyle, flex: 1, borderColor: '#378ADD' }}
                        type="number"
                        value={tcBNA}
                        onChange={e => setTcBNA(e.target.value)}
                        placeholder="Ej: 1050"
                      />
                      <button
                        onClick={cargarTipoCambio}
                        disabled={tcCargando}
                        type="button"
                        style={{ padding: '8px 12px', border: '1px solid #378ADD', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#378ADD', whiteSpace: 'nowrap', fontWeight: '600' }}
                      >
                        {tcCargando ? '...' : '↻ BNA'}
                      </button>
                    </div>
                    {tcBNA && <small style={{ color: '#378ADD', fontSize: '11px', marginTop: '4px', display: 'block' }}>USD 1 = ARS {Number(tcBNA).toLocaleString('es-AR')}</small>}
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: '#378ADD' }}>Tax ID *</label>
                    <input
                      style={{ ...inputStyle, borderColor: invoiceTaxId ? '#e0e0e0' : '#F59E0B' }}
                      value={invoiceTaxId}
                      onChange={e => setInvoiceTaxId(e.target.value)}
                      placeholder="Ej: 516535531"
                    />
                  </div>
                  <div style={{ gridColumn: '2/-1' }}>
                    <label style={{ ...labelStyle, color: '#378ADD' }}>Dirección fiscal *</label>
                    <input
                      style={{ ...inputStyle, borderColor: invoiceDireccion ? '#e0e0e0' : '#F59E0B' }}
                      value={invoiceDireccion}
                      onChange={e => setInvoiceDireccion(e.target.value)}
                      placeholder="16192 Coastal Highway, City of Lewes..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Toggle IVA */}
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#FAFAFA', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
              <button
                type="button"
                onClick={() => setConIva(!conIva)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: conIva ? '#378ADD' : '#ddd', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: '3px', left: conIva ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left .2s', display: 'block' }} />
              </button>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: conIva ? '#378ADD' : '#888' }}>
                  {conIva ? 'Con IVA (21%)' : 'Sin IVA'}
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>
                  {conIva ? 'El total incluye IVA discriminado' : 'El total es el precio neto sin IVA'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'white', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '20px' }}>Ítems</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['Producto', 'Descripción', 'Cant.', 'Precio neto', 'Dto %', 'Prop %', conIva ? 'IVA' : '—', 'Subtotal', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px', fontWeight: '600', color: '#999', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '6px 4px' }}>
                      <select style={{ ...inputStyle, fontSize: '12px' }} value={it.prod_id} onChange={e => onProductoChange(i, e.target.value)}>
                        <option value="">— Producto —</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        <option value="_custom">✎ Personalizado</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px 4px' }}><input style={{ ...inputStyle, fontSize: '12px' }} value={it.descripcion} onChange={e => updItem(i, 'descripcion', e.target.value)} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inputStyle, fontSize: '12px', width: '64px' }} value={it.cantidad} onChange={e => updItem(i, 'cantidad', +e.target.value)} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inputStyle, fontSize: '12px', width: '110px' }} value={it.precio_neto} onChange={e => updItem(i, 'precio_neto', +e.target.value)} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inputStyle, fontSize: '12px', width: '60px' }} value={it.descuento_pct} min="0" max="100" onChange={e => updItem(i, 'descuento_pct', +e.target.value)} /></td>
                    <td style={{ padding: '6px 4px' }}><input type="number" style={{ ...inputStyle, fontSize: '12px', width: '60px' }} value={it.proporcional_pct} min="1" max="100" onChange={e => updItem(i, 'proporcional_pct', +e.target.value)} /></td>
                    <td style={{ padding: '6px 4px' }}>
                      {conIva
                        ? <select style={{ ...inputStyle, fontSize: '12px', width: '72px' }} value={it.alicuota_iva} onChange={e => updItem(i, 'alicuota_iva', +e.target.value)}>
                            <option value={21}>21%</option>
                            <option value={10.5}>10.5%</option>
                            <option value={27}>27%</option>
                            <option value={0}>0%</option>
                          </select>
                        : <span style={{ fontSize: '12px', color: '#aaa', padding: '0 8px' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                      {tipo === 'I' && tcBNA
                        ? <span style={{ color: '#378ADD' }}>USD {(calcSubtotal(it) / Number(tcBNA)).toFixed(2)}</span>
                        : formatMoney(calcSubtotal(it))
                      }
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <button onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C62828', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addItem} style={{ marginTop: '12px', padding: '7px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#555' }}>+ Agregar ítem</button>

          {/* Totales */}
          <div style={{ marginTop: '20px', background: '#F8FAFF', borderRadius: '10px', padding: '16px 20px', maxWidth: '320px', marginLeft: 'auto', border: '1px solid #e8eef8' }}>
            {tipo === 'I' && tcBNA ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#666' }}>
                  <span>Subtotal ARS</span><span>{formatMoney(neto)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#666' }}>
                  <span>TC BNA compra</span><span>ARS {Number(tcBNA).toLocaleString('es-AR')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', padding: '10px 0 0', borderTop: '1px solid #dde6f5', marginTop: '8px', color: '#1a1a2e' }}>
                  <span>Total USD</span>
                  <span style={{ color: '#378ADD' }}>USD {(neto / Number(tcBNA)).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px', textAlign: 'right' }}>
                  Equivalente: {formatMoney(neto)}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#666' }}>
                  <span>Subtotal neto</span><span style={{ color: '#333' }}>{formatMoney(neto)}</span>
                </div>
                {conIva && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: '#666' }}>
                    <span>IVA</span><span style={{ color: '#333' }}>{formatMoney(iva)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', padding: '10px 0 0', borderTop: '1px solid #dde6f5', marginTop: '8px', color: '#1a1a2e' }}>
                  <span>Total {!conIva && <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>(sin IVA)</span>}</span>
                  <span style={{ color: '#378ADD' }}>{formatMoney(total)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!guardado && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={guardar} disabled={guardando} style={{ padding: '11px 28px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', boxShadow: '0 2px 8px rgba(39,174,96,0.3)' }}>
              {guardando ? 'Guardando...' : '✓ Guardar factura'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
