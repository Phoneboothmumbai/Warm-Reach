import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import {
  Settings as SettingsIcon,
  Building,
  Users,
  Shield,
  Mail,
  MessageCircle,
  Linkedin,
  Save,
  Loader2,
  History,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const approvalModeConfig = {
  manual: {
    label: "Manual Approval",
    description: "All messages require explicit approval before sending",
    icon: Shield
  },
  auto_known: {
    label: "Auto-Approve Known",
    description: "Pre-approved blueprints send automatically",
    icon: CheckCircle
  },
  autopilot: {
    label: "Full Autopilot",
    description: "All messages send automatically (requires unlock)",
    icon: AlertTriangle,
    locked: true
  }
};

export const SettingsPage = () => {
  const { authFetch, user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tenantForm, setTenantForm] = useState({
    name: "",
    company_name: "",
    approval_mode: "manual"
  });

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [tenantRes, usersRes, logsRes] = await Promise.all([
        authFetch(`${API}/settings/tenant`),
        isAdmin ? authFetch(`${API}/settings/users`) : Promise.resolve({ ok: false }),
        isAdmin ? authFetch(`${API}/audit-logs?limit=50`) : Promise.resolve({ ok: false })
      ]);

      if (tenantRes.ok) {
        const tenantData = await tenantRes.json();
        setTenant(tenantData);
        setTenantForm({
          name: tenantData.name || "",
          company_name: tenantData.company_name || "",
          approval_mode: tenantData.approval_mode || "manual"
        });
      }
      if (usersRes.ok) setUsers(await usersRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTenant = async () => {
    if (!isOwner) {
      toast.error("Only owner can update tenant settings");
      return;
    }

    setSaving(true);
    try {
      const params = new URLSearchParams();
      if (tenantForm.name) params.append("name", tenantForm.name);
      if (tenantForm.company_name) params.append("company_name", tenantForm.company_name);
      if (tenantForm.approval_mode) params.append("approval_mode", tenantForm.approval_mode);

      const response = await authFetch(`${API}/settings/tenant?${params.toString()}`, {
        method: "PUT"
      });

      if (response.ok) {
        toast.success("Settings saved successfully");
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const roleColors = {
    owner: "bg-primary/15 text-primary border-primary/20",
    admin: "bg-secondary/15 text-secondary border-secondary/20",
    sales_user: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    read_only: "bg-muted text-muted-foreground border-border"
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2" />
          <div className="h-4 bg-muted rounded w-64" />
        </div>
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="heading-2" data-testid="settings-heading">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and team members
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization" data-testid="settings-org-tab">
            <Building className="w-4 h-4 mr-2" />
            Organization
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="team" data-testid="settings-team-tab">
              <Users className="w-4 h-4 mr-2" />
              Team
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="audit" data-testid="settings-audit-tab">
              <History className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          )}
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={tenantForm.name}
                    onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                    disabled={!isOwner}
                    data-testid="org-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={tenantForm.company_name}
                    onChange={(e) => setTenantForm({ ...tenantForm, company_name: e.target.value })}
                    disabled={!isOwner}
                    data-testid="company-name-input"
                  />
                </div>
              </div>
              {isOwner && (
                <Button onClick={handleSaveTenant} disabled={saving} data-testid="save-org-btn">
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Approval Mode</CardTitle>
              <CardDescription>
                Control how messages are approved before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {Object.entries(approvalModeConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  const isSelected = tenantForm.approval_mode === key;
                  const isLocked = config.locked;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "p-4 rounded-lg border-2 transition-colors cursor-pointer",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                        isLocked && "opacity-60 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (!isLocked && isOwner) {
                          setTenantForm({ ...tenantForm, approval_mode: key });
                        }
                      }}
                      data-testid={`approval-mode-${key}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{config.label}</p>
                            {isLocked && (
                              <Badge variant="outline" className="text-xs">Locked</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {config.description}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isOwner && (
                <Button onClick={handleSaveTenant} disabled={saving} data-testid="save-approval-btn">
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="card-surface">
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>
                Daily and weekly sending limits per channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <span className="font-medium">Email</span>
                  </div>
                  <p className="text-2xl font-bold">{tenant?.rate_limits?.email_daily || 10}</p>
                  <p className="text-sm text-muted-foreground">per day</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium">WhatsApp</span>
                  </div>
                  <p className="text-2xl font-bold">{tenant?.rate_limits?.whatsapp_daily || 10}</p>
                  <p className="text-sm text-muted-foreground">per day</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium">LinkedIn</span>
                  </div>
                  <p className="text-2xl font-bold">{tenant?.rate_limits?.linkedin_weekly || 3}</p>
                  <p className="text-sm text-muted-foreground">per week</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Rate limits are enforced at send-time to protect your sender reputation
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        {isAdmin && (
          <TabsContent value="team">
            <Card className="card-surface">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Users with access to this organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {users.map((teamUser) => (
                      <div
                        key={teamUser.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                        data-testid={`team-member-${teamUser.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {teamUser.first_name?.[0]}{teamUser.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {teamUser.first_name} {teamUser.last_name}
                              {teamUser.id === user?.id && (
                                <span className="text-xs text-muted-foreground ml-2">(you)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{teamUser.email}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-xs border capitalize", roleColors[teamUser.role])}>
                          {teamUser.role?.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Audit Log Tab */}
        {isAdmin && (
          <TabsContent value="audit">
            <Card className="card-surface">
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  Recent actions in your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No audit logs yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => {
                        const logUser = users.find(u => u.id === log.user_id);
                        return (
                          <div
                            key={log.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 text-sm"
                            data-testid={`audit-log-${log.id}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {logUser?.first_name?.[0] || "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p>
                                <span className="font-medium">
                                  {logUser ? `${logUser.first_name} ${logUser.last_name}` : "Unknown"}
                                </span>
                                {" "}
                                <span className="text-muted-foreground">{log.action}</span>
                                {" "}
                                <span className="font-medium">{log.resource_type}</span>
                              </p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {log.resource_id}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
