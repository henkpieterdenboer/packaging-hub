'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Role, RoleLabels, RoleType } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string
  email: string
  firstName: string
  middleName: string | null
  lastName: string
  roles: string[]
  isActive: boolean
  createdAt: string
}

interface EmployeeFormData {
  email: string
  firstName: string
  middleName: string
  lastName: string
  roles: RoleType[]
  isActive: boolean
}

const emptyForm: EmployeeFormData = {
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  roles: [],
  isActive: true,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EmployeeFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch ----------------------------------------------------------------

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/employees')
      if (!res.ok) throw new Error('Failed to fetch employees')
      const data: Employee[] = await res.json()
      setEmployees(data)
    } catch {
      toast.error('Could not load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // ── Dialog helpers -------------------------------------------------------

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id)
    setForm({
      email: emp.email,
      firstName: emp.firstName,
      middleName: emp.middleName ?? '',
      lastName: emp.lastName,
      roles: emp.roles as RoleType[],
      isActive: emp.isActive,
    })
    setDialogOpen(true)
  }

  function toggleRole(role: RoleType) {
    setForm((prev) => {
      const has = prev.roles.includes(role)
      return {
        ...prev,
        roles: has
          ? prev.roles.filter((r) => r !== role)
          : [...prev.roles, role],
      }
    })
  }

  // ── Submit ---------------------------------------------------------------

  async function handleSubmit() {
    if (!form.email || !form.firstName || !form.lastName) {
      toast.error('Please fill in all required fields')
      return
    }
    if (form.roles.length === 0) {
      toast.error('Select at least one role')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        email: form.email,
        firstName: form.firstName,
        middleName: form.middleName || null,
        lastName: form.lastName,
        roles: form.roles,
        ...(editingId ? { isActive: form.isActive } : {}),
      }

      const url = editingId
        ? `/api/admin/employees/${editingId}`
        : '/api/admin/employees'

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }

      toast.success(editingId ? 'Employee updated' : 'Employee created')
      setDialogOpen(false)
      fetchEmployees()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers --------------------------------------------------------------

  function fullName(emp: Employee) {
    return [emp.firstName, emp.middleName, emp.lastName]
      .filter(Boolean)
      .join(' ')
  }

  // ── Render ---------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Employee Management
        </h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">
              Loading...
            </p>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No employees found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {fullName(emp)}
                    </TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {emp.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {RoleLabels[role as RoleType] ?? role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={emp.isActive ? 'default' : 'destructive'}
                      >
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog ─────────────────────────────────────────────────────── */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="user@example.com"
              />
            </div>

            {/* First name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
            </div>

            {/* Middle name */}
            <div className="grid gap-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, middleName: e.target.value }))
                }
              />
            </div>

            {/* Last name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </div>

            {/* Roles */}
            <div className="grid gap-2">
              <Label>Roles *</Label>
              <div className="flex gap-4">
                {(Object.keys(Role) as RoleType[]).map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={form.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    {RoleLabels[role]}
                  </label>
                ))}
              </div>
            </div>

            {/* Active toggle (edit only) */}
            {editingId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: checked === true,
                    }))
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? 'Saving...'
                : editingId
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
