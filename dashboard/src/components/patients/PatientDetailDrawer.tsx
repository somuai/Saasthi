"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientDetail } from "@/hooks/usePatients";
import { Loader2, Phone, MessageSquare, FileText, UserCircle, Activity, BrainCircuit, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Recharts components will be added later for the Vitals Chart

export function PatientDetailDrawer({ 
  patientId, 
  isOpen, 
  onClose 
}: { 
  patientId: number | null, 
  isOpen: boolean, 
  onClose: () => void 
}) {
  const { data: patient, isLoading } = usePatientDetail(patientId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto p-0 sm:p-6 bg-slate-50">
        
        {isLoading || !patient ? (
          <div className="h-full flex flex-col items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-[#416CAF]" />
            <p className="mt-4 text-muted-foreground">Loading patient record...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-6">
            
            {/* Header Section */}
            <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center shrink-0 text-2xl font-bold">
                  {patient.name.charAt(0)}
                </div>
                <div>
                  <SheetTitle className="text-2xl font-bold text-gray-900">{patient.name}</SheetTitle>
                  <p className="text-gray-500 text-sm mt-1">
                    {patient.age} yrs • {patient.cohort} • {patient.village}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge className={patient.risk_level === 'High' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                      {patient.risk_level} Risk
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Assigned to: <span className="font-medium text-gray-700">{patient.assigned_worker_name}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Phone className="h-4 w-4" /> Call
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> SMS
                </Button>
                <Button size="sm" className="gap-2 bg-[#416CAF] hover:bg-[#2b4c80]">
                  <FileText className="h-4 w-4" /> Referral
                </Button>
              </div>
            </div>

            {/* Tabs Section */}
            <Tabs defaultValue="overview" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 bg-white border shadow-sm rounded-lg p-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-[#416CAF] data-[state=active]:text-white">
                  <UserCircle className="h-4 w-4 mr-2" /> Overview
                </TabsTrigger>
                <TabsTrigger value="vitals" className="data-[state=active]:bg-[#416CAF] data-[state=active]:text-white">
                  <Activity className="h-4 w-4 mr-2" /> Vitals
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-[#416CAF] data-[state=active]:text-white">
                  <History className="h-4 w-4 mr-2" /> History
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  <BrainCircuit className="h-4 w-4 mr-2" /> AI Insights
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 flex-1 bg-white border rounded-xl shadow-sm p-6 overflow-y-auto">
                <TabsContent value="overview" className="mt-0">
                  <h3 className="font-semibold text-lg mb-4">Patient Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Contact Number</p>
                        <p className="font-medium">{patient.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Last Visit Date</p>
                        <p className="font-medium">{format(new Date(patient.last_visit_date), 'MMMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Latest Vitals Summary</p>
                        {patient.vitals && patient.vitals.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            <div className="flex justify-between bg-slate-50 p-2 rounded">
                              <span className="text-sm">Blood Pressure</span>
                              <span className="font-medium">{patient.vitals[patient.vitals.length - 1].systolic}/{patient.vitals[patient.vitals.length - 1].diastolic} mmHg</span>
                            </div>
                            <div className="flex justify-between bg-slate-50 p-2 rounded">
                              <span className="text-sm">Weight</span>
                              <span className="font-medium">{patient.vitals[patient.vitals.length - 1].weight} kg</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No vitals recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vitals" className="mt-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Vitals Timeline</h3>
                  </div>
                  
                  {patient.vitals && patient.vitals.length > 0 ? (
                    <div className="h-72 w-full p-4 border rounded-lg bg-white shadow-sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={patient.vitals} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(str) => format(new Date(str), 'MMM dd')} 
                            tick={{ fontSize: 12 }} 
                          />
                          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                          <Tooltip 
                            labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line yAxisId="left" type="monotone" dataKey="systolic" name="Systolic BP" stroke="#e11d48" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line yAxisId="left" type="monotone" dataKey="diastolic" name="Diastolic BP" stroke="#f43f5e" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#416CAF" strokeWidth={2} />
                          <Line yAxisId="right" type="monotone" dataKey="sugar" name="Blood Sugar" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg bg-slate-50 text-slate-400">
                      No vitals data available to graph.
                    </div>
                  )}
                  
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Vitals Log</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">BP (mmHg)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Weight (kg)</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Sugar (mg/dL)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patient.vitals?.map((v: { date: string, systolic: number, diastolic: number, weight: number, sugar: number }, i: number) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="px-4 py-3">{format(new Date(v.date), 'MMM dd, yyyy')}</td>
                              <td className="px-4 py-3">
                                <span className={v.systolic > 140 ? 'text-red-600 font-medium' : ''}>
                                  {v.systolic}/{v.diastolic}
                                </span>
                              </td>
                              <td className="px-4 py-3">{v.weight}</td>
                              <td className="px-4 py-3">{v.sugar}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <h3 className="font-semibold text-lg mb-4">Medical History & Referrals</h3>
                  <div className="p-4 border rounded-lg bg-orange-50 border-orange-100 text-orange-800 mb-4">
                    <p className="font-medium">Recent Referral: PHC Center (Pending)</p>
                    <p className="text-sm mt-1">Referred on {format(new Date(), 'MMM dd, yyyy')} due to persistent high blood pressure.</p>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="mt-0">
                  <div className="flex items-start gap-6">
                    <div className="w-1/3 bg-purple-50 border border-purple-100 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                      <div className="text-4xl font-bold text-purple-700">{patient.ai_insights?.risk_score}</div>
                      <div className="text-sm font-medium text-purple-900 mt-1">AI Risk Score</div>
                      <Badge className="mt-3 bg-purple-600 hover:bg-purple-700">Gemma Model</Badge>
                    </div>
                    <div className="w-2/3 space-y-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <BrainCircuit className="h-5 w-5 text-purple-600" />
                          Contributing Factors
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-700">
                          {patient.ai_insights?.factors.map((factor: string, i: number) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Recommended Clinical Action</h4>
                        <div className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg text-gray-800">
                          {patient.ai_insights?.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
