'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Mail, ExternalLink } from 'lucide-react'
import { EmailTypeLabels, type EmailTypeType } from '@/types'

interface EmailLog {
  id: string
  type: string
  subject: string
  toAddress: string
  ccAddresses: string[]
  orderId: string | null
  sentById: string | null
  sentAt: string
  provider: string
  etherealUrl: string | null
  status: string
  errorMessage: string | null
  createdAt: string
  order: { orderNumber: string } | null
  sentBy: { firstName: string; lastName: string } | null
}

const typeColors: Record<string, string> = {
  ORDER: 'bg-blue-100 text-blue-800',
  ACTIVATION: 'bg-green-100 text-green-800',
  PASSWORD_RESET: 'bg-orange-100 text-orange-800',
}

const statusColors: Record<string, string> = {
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

export default function EmailsPage() {
  const { status } = useSession()
  const router = useRouter()

  const [emails, setEmails] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchEmails() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (typeFilter !== 'ALL') {
          params.set('type', typeFilter)
        }
        const url = params.toString()
          ? `/api/emails?${params.toString()}`
          : '/api/emails'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch emails')
        const data = await res.json()
        setEmails(data)
      } catch (err) {
        setError('Failed to load email logs. Please try again.')
        console.error('Failed to fetch emails:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchEmails()
    }
  }, [status, typeFilter])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Email Log
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            View all sent emails and their delivery status.
          </p>
        </div>
        <div className="w-48">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="ORDER">Order</SelectItem>
              <SelectItem value="ACTIVATION">Activation</SelectItem>
              <SelectItem value="PASSWORD_RESET">Password Reset</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">Loading email logs...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && emails.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Mail className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            No emails found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {typeFilter !== 'ALL'
              ? 'No emails match the selected filter.'
              : 'No emails have been sent yet.'}
          </p>
        </div>
      )}

      {/* Emails Table */}
      {!loading && !error && emails.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow
                  key={email.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedEmail(email)}
                >
                  <TableCell className="whitespace-nowrap">
                    {new Date(email.sentAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        typeColors[email.type] ?? 'bg-gray-100 text-gray-800'
                      }
                    >
                      {EmailTypeLabels[email.type as EmailTypeType] ?? email.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {email.subject}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {email.toAddress}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        statusColors[email.status] ?? 'bg-gray-100 text-gray-800'
                      }
                    >
                      {email.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {email.etherealUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={email.etherealUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Email Detail Dialog */}
      <Dialog
        open={!!selectedEmail}
        onOpenChange={(open) => {
          if (!open) setSelectedEmail(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <span className="font-medium text-gray-500">Type:</span>
                <span>
                  <Badge
                    className={
                      typeColors[selectedEmail.type] ?? 'bg-gray-100 text-gray-800'
                    }
                  >
                    {EmailTypeLabels[selectedEmail.type as EmailTypeType] ??
                      selectedEmail.type}
                  </Badge>
                </span>

                <span className="font-medium text-gray-500">Subject:</span>
                <span>{selectedEmail.subject}</span>

                <span className="font-medium text-gray-500">To:</span>
                <span>{selectedEmail.toAddress}</span>

                {selectedEmail.ccAddresses.length > 0 && (
                  <>
                    <span className="font-medium text-gray-500">CC:</span>
                    <span>{selectedEmail.ccAddresses.join(', ')}</span>
                  </>
                )}

                {selectedEmail.order && (
                  <>
                    <span className="font-medium text-gray-500">Order:</span>
                    <span className="font-mono">
                      {selectedEmail.order.orderNumber}
                    </span>
                  </>
                )}

                {selectedEmail.sentBy && (
                  <>
                    <span className="font-medium text-gray-500">Sent by:</span>
                    <span>
                      {selectedEmail.sentBy.firstName}{' '}
                      {selectedEmail.sentBy.lastName}
                    </span>
                  </>
                )}

                <span className="font-medium text-gray-500">Date:</span>
                <span>
                  {new Date(selectedEmail.sentAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>

                <span className="font-medium text-gray-500">Provider:</span>
                <span className="capitalize">{selectedEmail.provider}</span>

                <span className="font-medium text-gray-500">Status:</span>
                <span>
                  <Badge
                    className={
                      statusColors[selectedEmail.status] ??
                      'bg-gray-100 text-gray-800'
                    }
                  >
                    {selectedEmail.status}
                  </Badge>
                </span>

                {selectedEmail.errorMessage && (
                  <>
                    <span className="font-medium text-gray-500">Error:</span>
                    <span className="text-red-600">
                      {selectedEmail.errorMessage}
                    </span>
                  </>
                )}
              </div>

              {selectedEmail.etherealUrl && (
                <div className="pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={selectedEmail.etherealUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Ethereal
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
