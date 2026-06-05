import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  User as UserIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/date'

export default async function AccountPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  const formatDateSafe = (dateString: string | undefined) => {
    if (!dateString) return 'Not set'
    return formatDate(dateString)
  }

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account information and security settings
        </p>
      </div>

      <Separator />

      {/* Profile Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 overflow-hidden">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarFallback className="text-2xl">
                {getInitials(user.email || 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-2xl truncate">{user.email}</CardTitle>
              <CardDescription className="mt-1">
                <span className="break-all">User ID: {user.id}</span>
                {user.is_anonymous && (
                  <Badge variant="secondary" className="ml-2">Anonymous</Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Your email and phone details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{user.email || 'No email set'}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{user.phone || 'No phone number set'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
          <CardDescription>Your account security information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Role</p>
                <Badge variant="outline" className="mt-1">{user.role || 'authenticated'}</Badge>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Audience</p>
                <p className="text-sm text-muted-foreground mt-1">{user.aud || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Last Sign In</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDateSafe(user.last_sign_in_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Account Created</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDateSafe(user.created_at)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Information */}
      {user.app_metadata && Object.keys(user.app_metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Information</CardTitle>
            <CardDescription>Authentication providers and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.app_metadata.provider && (
              <div>
                <p className="text-sm font-medium mb-2">Primary Provider</p>
                <Badge variant="secondary">{user.app_metadata.provider}</Badge>
              </div>
            )}

            {user.app_metadata.providers && Array.isArray(user.app_metadata.providers) && (
              <div>
                <p className="text-sm font-medium mb-2">Available Providers</p>
                <div className="flex gap-2 flex-wrap">
                  {user.app_metadata.providers.map((provider: string) => (
                    <Badge key={provider} variant="outline">{provider}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linked Identities */}
      {user.identities && user.identities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Identities</CardTitle>
            <CardDescription>
              Connected accounts and identity providers ({user.identities.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.identities.map((identity, index) => (
                <div key={identity.id || index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge>{identity.provider}</Badge>
                        {identity.identity_data?.email && (
                          <span className="text-sm text-muted-foreground">
                            {identity.identity_data.email}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Identity ID: {identity.id}
                      </p>
                      {identity.created_at && (
                        <p className="text-xs text-muted-foreground">
                          Linked: {formatDateSafe(identity.created_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
