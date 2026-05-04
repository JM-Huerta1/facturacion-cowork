'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from './supabase'
import { useState } from 'react'

const NAV = [
  { label: 'Factura individual', href: '/dashboard', icon: '🧾' },
  { label: 'Facturación mensual', href: '/dashboard/mensual', icon: '📅' },
  { label: 'Clientes', href: '/dashboard/clientes', icon: '👥' },
  { label: 'Productos', href: '/dashboard/productos', icon: '📦' },
  { label: 'Sedes', href: '/dashboard/sedes', icon: '🏢' },
  { label: 'Usuarios', href: '/dashboard/usuarios', icon: '👤' },
  { label: 'Importar clientes', href: '/dashboard/clientes/importar', icon: '📥' },
  { label: 'Importar productos', href: '/dashboard/productos/importar', icon: '📦' },
]

export default function Layout({ children, usuario }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [cerrando, setCerrando] = useState(false)

  async function cerrarSesion() {
    setCerrando(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", background: '#F4F6FA' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'linear-gradient(180deg, #0F1923 0%, #1A2535 100%)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)'
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: '#378ADD', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '.02em' }}>Cowork</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>Sistema de facturación</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 10px 6px' }}>Operaciones</div>
          {NAV.slice(0, 2).map(item => {
            const activo = pathname === item.href
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '8px', marginBottom: '2px',
                background: activo ? 'rgba(55,138,221,0.2)' : 'transparent',
                color: activo ? '#6BB8F5' : 'rgba(255,255,255,0.55)',
                textDecoration: 'none', fontSize: '13px', fontWeight: activo ? '600' : '400',
                borderLeft: activo ? '3px solid #378ADD' : '3px solid transparent',
                transition: 'all .15s'
              }}>
                <span style={{ fontSize: '15px' }}>{item.icon}</span>
                {item.label}
              </a>
            )
          })}

          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: '.08em', textTransform: 'uppercase', padding: '14px 10px 6px' }}>Gestión</div>
          {NAV.slice(2).map(item => {
            const activo = pathname === item.href
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '8px', marginBottom: '2px',
                background: activo ? 'rgba(55,138,221,0.2)' : 'transparent',
                color: activo ? '#6BB8F5' : 'rgba(255,255,255,0.55)',
                textDecoration: 'none', fontSize: '13px', fontWeight: activo ? '600' : '400',
                borderLeft: activo ? '3px solid #378ADD' : '3px solid transparent',
                transition: 'all .15s'
              }}>
                <span style={{ fontSize: '15px' }}>{item.icon}</span>
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* Usuario */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {(usuario?.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usuario?.email}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Admin</div>
            </div>
          </div>
          <button onClick={cerrarSesion} disabled={cerrando} style={{
            width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', background: 'transparent', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: '12px'
          }}>
            {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>

    </div>
  )
}