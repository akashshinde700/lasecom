'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type ViewName } from '@/lib/store'
import { api } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, EyeOff, Loader2, ShoppingBag } from 'lucide-react'

const VALID_VIEWS: ViewName[] = [
  'home', 'listing', 'product', 'vendor', 'cart', 'checkout', 'order-success',
  'orders', 'order-detail', 'wishlist', 'account', 'auth', 'notifications',
  'static', 'vendor-panel', 'admin-panel',
]

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function AuthView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const mergeGuestCartOnLogin = useAppStore((s) => s.mergeGuestCartOnLogin)

  // Links open a specific tab via `#/auth?tab=register|vendor` ("vendor" is the Sell tab)
  const tabFromParams = (t?: string) => (t === 'register' ? 'register' : t === 'vendor' || t === 'sell' ? 'sell' : 'login')
  const [tab, setTab] = useState(() => tabFromParams(params.tab))
  useEffect(() => {
    setTab(tabFromParams(params.tab))
  }, [params.tab])
  const [busy, setBusy] = useState(false)

  // login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // register
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  // vendor
  const [vName, setVName] = useState('')
  const [vBusiness, setVBusiness] = useState('')
  const [vEmail, setVEmail] = useState('')
  const [vPhone, setVPhone] = useState('')
  const [vGstin, setVGstin] = useState('')
  const [vCity, setVCity] = useState('')
  const [vState, setVState] = useState('')
  const [vPassword, setVPassword] = useState('')

  const routeAfterAuth = (role: string) => {
    const r = params.redirect
    if (r && VALID_VIEWS.includes(r as ViewName) && r !== 'auth') {
      navigate(r as ViewName)
      return
    }
    if (role === 'VENDOR_ADMIN' || role === 'VENDOR_STAFF') navigate('vendor-panel')
    else if (role === 'PLATFORM_ADMIN' || role === 'PLATFORM_STAFF') navigate('admin-panel')
    else navigate('home')
  }

  useEffect(() => {
    if (!authLoading && user) {
      routeAfterAuth(user.role)
    }
  }, [authLoading, user])

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto mb-2 h-6 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
      </div>
    )
  }
  if (user) return null

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Enter your email and password')
      return
    }
    setBusy(true)
    const res = await api<{ id: string; role: string }>('/api/auth', {
      method: 'POST',
      json: { action: 'login', email: email.trim(), password },
    })
    if (!res.ok) {
      setBusy(false)
      toast.error(res.error ?? 'Login failed')
      return
    }
    await refreshMe()
    await mergeGuestCartOnLogin()
    toast.success(`Welcome back to Lastrivon Kart!`)
    routeAfterAuth(res.data?.role ?? 'CUSTOMER')
    setBusy(false)
  }

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      toast.error('Name, email and password are required')
      return
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setBusy(true)
    const res = await api<{ role: string }>('/api/auth', {
      method: 'POST',
      json: {
        action: 'register',
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        password: regPassword,
      },
    })
    if (!res.ok) {
      setBusy(false)
      toast.error(res.error ?? 'Registration failed')
      return
    }
    await refreshMe()
    await mergeGuestCartOnLogin()
    toast.success(`Account created. Welcome to Lastrivon Kart, ${regName.trim()}!`)
    routeAfterAuth(res.data?.role ?? 'CUSTOMER')
    setBusy(false)
  }

  const doVendorRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vName.trim() || !vBusiness.trim() || !vEmail.trim() || !vPassword) {
      toast.error('Owner name, business name, email and password are required')
      return
    }
    if (vPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setBusy(true)
    const res = await api('/api/auth', {
      method: 'POST',
      json: {
        action: 'vendor-register',
        name: vName.trim(),
        businessName: vBusiness.trim(),
        email: vEmail.trim(),
        phone: vPhone.trim() || undefined,
        gstin: vGstin.trim() || undefined,
        city: vCity.trim() || undefined,
        state: vState.trim() || undefined,
        password: vPassword,
      },
    })
    if (!res.ok) {
      setBusy(false)
      toast.error(res.error ?? 'Registration failed')
      return
    }
    await refreshMe()
    toast.success('Application submitted! Awaiting admin approval.')
    navigate('vendor-panel')
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Lastrivon Kart India</h1>
        <p className="mt-1 text-sm text-stone-500">India&apos;s multi-vendor marketplace — 1P quality, 3P variety</p>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="login" className="text-xs sm:text-sm">Login</TabsTrigger>
              <TabsTrigger value="register" className="text-xs sm:text-sm">Register</TabsTrigger>
              <TabsTrigger value="sell" className="text-xs sm:text-sm">Sell</TabsTrigger>
            </TabsList>

            {/* ------------------------------ LOGIN ------------------------------ */}
            <TabsContent value="login">
              <form onSubmit={doLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            {/* ----------------------------- REGISTER ---------------------------- */}
            <TabsContent value="register">
              <form onSubmit={doRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Full name</Label>
                  <Input id="reg-name" placeholder="Priya Sharma" value={regName} onChange={(e) => setRegName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">Phone (optional)</Label>
                  <Input id="reg-phone" placeholder="+91 98765 43210" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password</Label>
                  <PasswordInput id="reg-password" value={regPassword} onChange={setRegPassword} autoComplete="new-password" />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
              </form>
            </TabsContent>

            {/* ------------------------------- SELL ------------------------------ */}
            <TabsContent value="sell">
              <div className="mb-4 rounded-lg bg-orange-50 p-3 text-xs leading-relaxed text-orange-800">
                Start selling to customers across India. Your store goes live after a quick admin review — usually within 24 hours.
              </div>
              <form onSubmit={doVendorRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="v-name">Owner name</Label>
                    <Input id="v-name" placeholder="Amit Verma" value={vName} onChange={(e) => setVName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-business">Business name</Label>
                    <Input id="v-business" placeholder="Verma Electronics" value={vBusiness} onChange={(e) => setVBusiness(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-email">Email</Label>
                  <Input id="v-email" type="email" placeholder="business@example.com" value={vEmail} onChange={(e) => setVEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-phone">Phone</Label>
                  <Input id="v-phone" placeholder="+91 98765 43210" value={vPhone} onChange={(e) => setVPhone(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="v-city">City</Label>
                    <Input id="v-city" placeholder="Mumbai" value={vCity} onChange={(e) => setVCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-state">State</Label>
                    <Select value={vState} onValueChange={setVState}>
                      <SelectTrigger id="v-state" className="w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat', 'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Kerala', 'Punjab', 'Haryana', 'Other'].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-gstin">
                    GSTIN <span className="font-normal text-stone-400">(optional)</span>
                  </Label>
                  <Input id="v-gstin" placeholder="22AAAAA0000A1Z5" value={vGstin} onChange={(e) => setVGstin(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-password">Password</Label>
                  <PasswordInput id="v-password" value={vPassword} onChange={setVPassword} autoComplete="new-password" />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply to sell on Lastrivon Kart
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
