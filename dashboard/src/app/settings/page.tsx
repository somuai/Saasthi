"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProfile, useAlertConfig, useSystemHealth } from '@/hooks/useSettings';
import { SystemHealthPanel } from '@/components/settings/SystemHealthPanel';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { User, Phone, MapPin, Building2, Calendar, Info, Check, X } from 'lucide-react';

export default function SettingsPage() {
  const { data: profile, isLoading: isProfileLoading } = useUserProfile();
  const { data: alertConfig, isLoading: isConfigLoading } = useAlertConfig();
  const { data: systemHealth, isLoading: isHealthLoading } = useSystemHealth();
  const { isConnected } = useWebSocket();

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <Badge className="bg-red-500 hover:bg-red-600 text-white">CRITICAL</Badge>;
      case 'HIGH': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">HIGH</Badge>;
      case 'MEDIUM': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">MEDIUM</Badge>;
      case 'LOW': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">LOW</Badge>;
      default: return <Badge>{severity}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      </div>
      <p className="text-muted-foreground mb-6">Manage your profile, alert configuration, and system preferences.</p>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="alerts">Alert Configuration</TabsTrigger>
          <TabsTrigger value="regions">Geographic Regions</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your personal details and role assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              {isProfileLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              ) : profile && (
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 bg-[#416CAF] text-white rounded-full flex items-center justify-center text-3xl font-bold">
                      {profile.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <Badge variant="outline" className="uppercase">{profile.role}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 flex-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1"><User className="w-4 h-4" /> Full Name</div>
                      <div className="font-medium text-lg">{profile.name}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1"><Phone className="w-4 h-4" /> Phone Number</div>
                      <div className="font-medium text-lg">{profile.phone}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1"><MapPin className="w-4 h-4" /> Jurisdiction</div>
                      <div className="font-medium text-lg">{profile.jurisdiction}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1"><Building2 className="w-4 h-4" /> Primary Facility</div>
                      <div className="font-medium text-lg">{profile.facility}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1"><Calendar className="w-4 h-4" /> Member Since</div>
                      <div className="font-medium text-lg">{profile.joined_at}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-8 border-t pt-6">
                <Button disabled className="bg-[#416CAF]">Edit Profile</Button>
                <p className="text-xs text-muted-foreground mt-2">Profile editing is currently managed by IT administrators.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Escalation Thresholds</CardTitle>
              <CardDescription>Configure how and when different severities of alerts are escalated.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border-blue-200 border text-blue-800 p-4 rounded-lg flex items-start gap-3 mb-6">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">Alert thresholds determine when unacknowledged alerts are automatically escalated to the next level of management.</p>
              </div>

              {isConfigLoading ? <Skeleton className="h-[200px] w-full" /> : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Auto-Escalate After</TableHead>
                        <TableHead className="text-center">Notify Supervisor</TableHead>
                        <TableHead className="text-center">Notify Doctor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertConfig?.map((config) => (
                        <TableRow key={config.severity}>
                          <TableCell className="font-medium">{getSeverityBadge(config.severity)}</TableCell>
                          <TableCell>{config.auto_escalate_after_min} minutes</TableCell>
                          <TableCell className="text-center">
                            {config.notify_supervisor ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-center">
                            {config.notify_doctor ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-300 mx-auto" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button disabled>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Assigned Jurisdiction</CardTitle>
                <CardDescription>Regions you are responsible for monitoring.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Mumbai North District</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                      <li>Andheri West Block (14 villages)</li>
                      <li>Borivali Block (22 villages)</li>
                      <li>Malad East Sector (8 villages)</li>
                      <li>Kandivali Sector (11 villages)</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    Contact system administrator to modify geographic assignments.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 bg-[#416CAF]/5 border-[#416CAF]/20">
              <CardHeader>
                <CardTitle className="text-[#416CAF]">Jurisdiction Overview</CardTitle>
                <CardDescription>Current footprint of your assigned areas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-3xl font-bold">142</div>
                    <div className="text-sm text-muted-foreground">Total H3 Cells</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">55</div>
                    <div className="text-sm text-muted-foreground">ASHA Workers</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-3xl font-bold">42,500</div>
                    <div className="text-sm text-muted-foreground">Registered Population</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Status</CardTitle>
              <CardDescription>Real-time metrics for underlying Saasthi infrastructure.</CardDescription>
            </CardHeader>
            <CardContent>
              {isHealthLoading ? <Skeleton className="h-[300px] w-full" /> : (
                <SystemHealthPanel services={systemHealth || []} />
              )}
              
              <div className="grid md:grid-cols-2 gap-4 mt-8 pt-8 border-t">
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">WebSocket Connection</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="font-semibold">{isConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">API Base URL</h4>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
