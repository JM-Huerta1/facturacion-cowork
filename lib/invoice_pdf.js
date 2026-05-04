import jsPDF from 'jspdf'

export function generarInvoicePDF(comprobante, cliente, sede, items) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const margin = 50

  // ── COLORES ──────────────────────────────────────────────
  const gris = [80, 80, 80]
  const grisOscuro = [50, 50, 50]
  const grisMedio = [120, 120, 120]
  const grisFondo = [220, 225, 230]
  const grisFondoTabla = [100, 100, 100]
  const rojo = [180, 30, 30]
  const blanco = [255, 255, 255]
  const negro = [0, 0, 0]
  const azulClaro = [180, 205, 220]

  // ── HELPERS ──────────────────────────────────────────────
  function setFont(size, style = 'normal', color = negro) {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(...color)
  }

  function rect(x, y, w, h, color, filled = true) {
    doc.setFillColor(...color)
    doc.setDrawColor(...color)
    if (filled) doc.rect(x, y, w, h, 'F')
    else doc.rect(x, y, w, h, 'S')
  }

  function line(x1, y1, x2, y2, color = grisMedio, width = 0.5) {
    doc.setDrawColor(...color)
    doc.setLineWidth(width)
    doc.line(x1, y1, x2, y2)
  }

  function box(x, y, w, h, borderColor = rojo) {
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(1.5)
    doc.rect(x, y, w, h, 'S')
  }

  // ── NÚMERO DE INVOICE ──────────────────────────────────
  const invoiceNum = comprobante.invoice_numero || 1000

  // ── ENCABEZADO ────────────────────────────────────────
  // Título INVOICE
  setFont(36, 'bold', negro)
  doc.text('INVOICE', W - margin, 60, { align: 'right' })

  // Datos emisor
  setFont(11, 'bold', negro)
  doc.text('Z Performance Lab', margin, 60)
  setFont(10, 'normal', grisMedio)
  doc.text('Huerta Coworking.', margin, 75)
  doc.text('', margin, 90)
  doc.text('16192 Coastal Highway,', margin, 105)
  doc.text('City of Lewes, DE 19958', margin, 120)

  // ── CAJA INVOICE # y DATE ────────────────────────────
  const boxX = W - margin - 200
  const boxY = 75
  const boxW = 200
  const boxH = 40

  // Header de la caja
  rect(boxX, boxY, boxW, boxH, grisFondoTabla)
  setFont(9, 'bold', blanco)
  doc.text('INVOICE #', boxX + 50, boxY + 15, { align: 'center' })
  doc.text('DATE', boxX + 150, boxY + 15, { align: 'center' })

  // Valores
  rect(boxX, boxY + boxH, boxW, 28, [240, 240, 240])
  setFont(10, 'bold', negro)
  doc.text(String(invoiceNum), boxX + 50, boxY + boxH + 18, { align: 'center' })
  const fechaFormateada = formatearFecha(comprobante.fecha)
  doc.text(fechaFormateada, boxX + 150, boxY + boxH + 18, { align: 'center' })

  // Línea separadora vertical en la caja
  line(boxX + 100, boxY, boxX + 100, boxY + boxH + 28, [180, 180, 180])
  box(boxX, boxY, boxW, boxH + 28, rojo)

  // ── CAJA CUSTOMER ID / TERMS ─────────────────────────
  const box2Y = boxY + boxH + 28 + 8
  rect(boxX, box2Y, boxW, 30, grisFondoTabla)
  setFont(9, 'bold', blanco)
  doc.text('CUSTOMER ID', boxX + 50, box2Y + 15, { align: 'center' })
  doc.text('TERMS', boxX + 150, box2Y + 15, { align: 'center' })

  rect(boxX, box2Y + 30, boxW, 25, [240, 240, 240])
  setFont(9, 'normal', negro)
  doc.text(cliente.cuit || '', boxX + 50, box2Y + 45, { align: 'center' })
  doc.text('Net 30', boxX + 150, box2Y + 45, { align: 'center' })

  line(boxX + 100, box2Y, boxX + 100, box2Y + 55, [180, 180, 180])
  box(boxX, box2Y, boxW, 55, rojo)

  // ── CAJA CLIENTE (con fondo gris azulado) ────────────
  const clienteBoxY = 145
  const clienteBoxH = 80
  rect(margin, clienteBoxY, 300, clienteBoxH, grisFondo)
  box(margin, clienteBoxY, 300, clienteBoxH, rojo)

  setFont(10, 'bold', negro)
  doc.text(`Razon social : ${cliente.razon_social || ''}`, margin + 10, clienteBoxY + 20)
  doc.text(`TAX ID : ${comprobante.invoice_tax_id || cliente.tax_id || ''}`, margin + 10, clienteBoxY + 38)

  const direccion = comprobante.invoice_direccion || cliente.direccion || ''
  if (direccion) {
    setFont(10, 'bold', negro)
    const dirLines = doc.splitTextToSize(`Direccion: ${direccion}`, 280)
    doc.text(dirLines, margin + 10, clienteBoxY + 56)
  }

  // ── TABLA DE ÍTEMS ───────────────────────────────────
  const tableY = clienteBoxY + clienteBoxH + 30
  const colDesc = margin
  const colQty = W - margin - 200
  const colPrice = W - margin - 130
  const colAmount = W - margin - 50
  const colW = W - margin * 2

  // Header tabla
  rect(margin, tableY, colW, 28, grisFondoTabla)
  setFont(9, 'bold', blanco)
  doc.text('DESCRIPTION', colDesc + 10, tableY + 18)
  doc.text('QTY', colQty, tableY + 18, { align: 'center' })
  doc.text('INIT PRIC', colPrice, tableY + 18, { align: 'center' })
  doc.text('AMOUNT', colAmount, tableY + 18, { align: 'right' })
  box(margin, tableY, colW, 28, rojo)

  // Filas de ítems
  let rowY = tableY + 28
  const rowH = 28
  const maxFilas = 10

  for (let i = 0; i < maxFilas; i++) {
    const it = items[i]
    const bgColor = i % 2 === 0 ? blanco : [248, 248, 248]
    rect(margin, rowY, colW, rowH, bgColor)
    line(margin, rowY + rowH, margin + colW, rowY + rowH, [210, 210, 210])

    if (it) {
      const base = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
      setFont(9, 'normal', negro)
      doc.text(it.descripcion || '', colDesc + 10, rowY + 18)
      doc.text(String(it.cantidad), colQty, rowY + 18, { align: 'center' })
      doc.text(formatUSD(it.precio_neto), colPrice, rowY + 18, { align: 'center' })
      doc.text(formatUSD(base), colAmount, rowY + 18, { align: 'right' })
    } else {
      setFont(9, 'normal', [200, 200, 200])
      doc.text('-', colAmount, rowY + 18, { align: 'right' })
    }
    rowY += rowH
  }

  // Borde tabla
  box(margin, tableY, colW, 28 + rowH * maxFilas, rojo)

  // Líneas verticales tabla
  line(colQty - 15, tableY, colQty - 15, tableY + 28 + rowH * maxFilas, [200, 200, 200])
  line(colPrice - 15, tableY, colPrice - 15, tableY + 28 + rowH * maxFilas, [200, 200, 200])
  line(colAmount - 15, tableY, colAmount - 15, tableY + 28 + rowH * maxFilas, [200, 200, 200])

  // ── TOTALES ──────────────────────────────────────────
  const totalY = rowY + 10
  const totW = 200
  const totX = W - margin - totW

  const neto = items.reduce((s, it) => {
    return s + Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
  }, 0)
  const iva = items.reduce((s, it) => {
    const b = Number(it.precio_neto) * Number(it.cantidad) * (1 - Number(it.descuento_pct) / 100) * (Number(it.proporcional_pct) / 100)
    return s + b * (Number(it.alicuota_iva) / 100)
  }, 0)
  const total = neto + iva

  // Fondo totales
  rect(totX, totalY, totW, 90, [235, 235, 235])
  box(totX, totalY, totW, 90, rojo)

  setFont(9, 'normal', negro)
  doc.text('SUBTOTAL', totX + 10, totalY + 18)
  doc.text(formatUSD(neto), totX + totW - 10, totalY + 18, { align: 'right' })

  line(totX, totalY + 25, totX + totW, totalY + 25, [200, 200, 200])

  doc.text('TAX RATE', totX + 10, totalY + 40)
  doc.text('', totX + totW - 10, totalY + 40, { align: 'right' })

  line(totX, totalY + 47, totX + totW, totalY + 47, [200, 200, 200])

  doc.text('TAX', totX + 10, totalY + 62)
  doc.text('-', totX + totW - 10, totalY + 62, { align: 'right' })

  line(totX, totalY + 69, totX + totW, totalY + 69, [150, 150, 150], 1)

  setFont(10, 'bold', negro)
  doc.text('TOTAL', totX + 10, totalY + 83)
  doc.text(`USD  ${formatUSD(total)}`, totX + totW - 10, totalY + 83, { align: 'right' })

  // ── THANK YOU ────────────────────────────────────────
  setFont(11, 'bolditalic', [0, 130, 80])
  doc.text('Thank you for your business!', margin, totalY + 50)

  // ── LÍNEA AZUL INFERIOR ──────────────────────────────
  line(margin, totalY + 100, W - margin, totalY + 100, azulClaro, 2)

  // ── DESCARGAR ────────────────────────────────────────
  doc.save(`invoice_${invoiceNum}_${cliente.razon_social?.replace(/\s/g, '_')}.pdf`)
}

function formatUSD(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return ''
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [y, m, d] = fechaStr.split('-')
  return `${meses[parseInt(m) - 1]} ${d} - ${y}`
}