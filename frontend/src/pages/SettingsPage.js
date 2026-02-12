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
  ExternalLink,
  Plus,
  X,
  Target,
  Compass,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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

  // WhatsApp settings state
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState({
    phone_number_id: "",
    access_token: ""
  });
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  // IP Whitelist state
  const [ipWhitelist, setIpWhitelist] = useState({ global_ips: [], tenant_ips: [] });
  const [newIpAddress, setNewIpAddress] = useState("");
  const [savingIp, setSavingIp] = useState(false);

  // Custom options state (intents, angles, CTAs)
  const [customOptions, setCustomOptions] = useState({ intents: [], angles: [], ctas: [] });
  const [newIntent, setNewIntent] = useState({ name: "", description: "" });
  const [newAngle, setNewAngle] = useState({ name: "", description: "" });
  const [newCta, setNewCta] = useState({ name: "", description: "" });
  const [savingOption, setSavingOption] = useState(false);
  
  // AI Instructions
  const [aiInstructions, setAiInstructions] = useState({ message_instructions: "", blueprint_instructions: "" });
  const [savingInstructions, setSavingInstructions] = useState(false);

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [tenantRes, usersRes, logsRes, whatsappRes, ipRes, customRes, aiRes] = await Promise.all([
        authFetch(`${API}/settings/tenant`),
        isAdmin ? authFetch(`${API}/settings/users`) : Promise.resolve({ ok: false }),
        isAdmin ? authFetch(`${API}/audit-logs?limit=50`) : Promise.resolve({ ok: false }),
        isAdmin ? authFetch(`${API}/settings/whatsapp`) : Promise.resolve({ ok: false }),
        isAdmin ? authFetch(`${API}/settings/ip-whitelist`) : Promise.resolve({ ok: false }),
        authFetch(`${API}/settings/custom-options`),
        authFetch(`${API}/settings/ai-instructions`)
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
      if (whatsappRes.ok) {
        const waData = await whatsappRes.json();
        setWhatsappConfig(waData);
        if (waData.phone_number_id) {
          setWhatsappForm(prev => ({ ...prev, phone_number_id: waData.phone_number_id }));
        }
      }
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        setIpWhitelist(ipData);
      }
      if (customRes.ok) {
        const customData = await customRes.json();
        setCustomOptions(customData);
      }
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiInstructions(aiData);
      }
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAiInstructions = async () => {
    setSavingInstructions(true);
    try {
      const response = await authFetch(`${API}/settings/ai-instructions`, {
        method: "POST",
        body: JSON.stringify(aiInstructions)
      });
      if (response.ok) {
        toast.success("AI instructions saved");
      } else {
        toast.error("Failed to save AI instructions");
      }
    } catch (error) {
      toast.error("Failed to save AI instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleAddCustomOption = async (optionType, data) => {
    if (!isAdmin) {
      toast.error("Only admin can add custom options");
      return;
    }
    
    if (!data.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSavingOption(true);
    try {
      const response = await authFetch(`${API}/settings/custom-options`, {
        method: "POST",
        body: JSON.stringify({
          option_type: optionType,
          name: data.name,
          description: data.description
        })
      });

      if (response.ok) {
        toast.success(`Custom ${optionType} added`);
        fetchSettings();
        // Reset form
        if (optionType === "intent") setNewIntent({ name: "", description: "" });
        if (optionType === "angle") setNewAngle({ name: "", description: "" });
        if (optionType === "cta") setNewCta({ name: "", description: "" });
      } else {
        const error = await response.json();
        toast.error(error.detail || `Failed to add custom ${optionType}`);
      }
    } catch (error) {
      toast.error(`Failed to add custom ${optionType}`);
    } finally {
      setSavingOption(false);
    }
  };

  const handleDeleteCustomOption = async (optionId) => {
    if (!isAdmin) {
      toast.error("Only admin can delete custom options");
      return;
    }

    try {
      const response = await authFetch(`${API}/settings/custom-options/${optionId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success("Custom option deleted");
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to delete");
      }
    } catch (error) {
      toast.error("Failed to delete custom option");
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

  const handleSaveWhatsapp = async () => {
    if (!isOwner) {
      toast.error("Only owner can configure WhatsApp settings");
      return;
    }

    if (!whatsappForm.phone_number_id || !whatsappForm.access_token) {
      toast.error("Please enter both Phone Number ID and Access Token");
      return;
    }

    setSavingWhatsapp(true);
    try {
      const response = await authFetch(`${API}/settings/whatsapp`, {
        method: "POST",
        body: JSON.stringify(whatsappForm)
      });

      if (response.ok) {
        toast.success("WhatsApp credentials verified and saved!");
        setWhatsappForm(prev => ({ ...prev, access_token: "" }));
        setShowAccessToken(false);
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to save WhatsApp settings");
      }
    } catch (error) {
      toast.error("Failed to save WhatsApp settings");
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleDeleteWhatsapp = async () => {
    if (!confirm("Are you sure you want to remove WhatsApp configuration? You won't be able to send WhatsApp messages until you reconfigure.")) {
      return;
    }

    try {
      const response = await authFetch(`${API}/settings/whatsapp`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success("WhatsApp configuration removed");
        setWhatsappConfig(null);
        setWhatsappForm({ phone_number_id: "", access_token: "" });
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to remove WhatsApp settings");
      }
    } catch (error) {
      toast.error("Failed to remove WhatsApp settings");
    }
  };

  const handleAddIp = async () => {
    if (!newIpAddress.trim()) {
      toast.error("Please enter an IP address");
      return;
    }

    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIpAddress.trim())) {
      toast.error("Invalid IP address format");
      return;
    }

    setSavingIp(true);
    try {
      const response = await authFetch(`${API}/settings/ip-whitelist?ip_address=${encodeURIComponent(newIpAddress.trim())}`, {
        method: "POST"
      });

      if (response.ok) {
        toast.success(`IP ${newIpAddress} added to whitelist`);
        setNewIpAddress("");
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to add IP");
      }
    } catch (error) {
      toast.error("Failed to add IP");
    } finally {
      setSavingIp(false);
    }
  };

  const handleRemoveIp = async (ip) => {
    if (!confirm(`Remove ${ip} from whitelist?`)) return;

    try {
      const response = await authFetch(`${API}/settings/ip-whitelist/${encodeURIComponent(ip)}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success(`IP ${ip} removed from whitelist`);
        fetchSettings();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to remove IP");
      }
    } catch (error) {
      toast.error("Failed to remove IP");
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
            <TabsTrigger value="ai-instructions" data-testid="settings-ai-tab">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Instructions
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="blueprints" data-testid="settings-blueprints-tab">
              <Target className="w-4 h-4 mr-2" />
              Blueprints
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="integrations" data-testid="settings-integrations-tab">
              <MessageCircle className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
          )}
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

        {/* AI Instructions Tab */}
        {isAdmin && (
          <TabsContent value="ai-instructions" className="space-y-6">
            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Message Generation Instructions
                </CardTitle>
                <CardDescription>
                  Custom instructions that apply to all AI-generated messages. The AI will follow these rules when creating outreach messages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter instructions for message generation...

Example instructions:
- Keep messages short and under 3 sentences
- Don't start messages with the first name
- Always mention our phone number: 9769444455
- Use a friendly, conversational tone
- Focus on value, not features"
                  value={aiInstructions.message_instructions}
                  onChange={(e) => setAiInstructions(prev => ({ ...prev, message_instructions: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="message-instructions-textarea"
                />
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Blueprint Generation Instructions
                </CardTitle>
                <CardDescription>
                  Custom instructions that apply when generating message blueprints/templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter instructions for blueprint generation...

Example instructions:
- Focus on our value proposition
- Use a casual, approachable tone
- Emphasize quick response times
- Include a soft call-to-action"
                  value={aiInstructions.blueprint_instructions}
                  onChange={(e) => setAiInstructions(prev => ({ ...prev, blueprint_instructions: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="blueprint-instructions-textarea"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={handleSaveAiInstructions} 
                disabled={savingInstructions}
                data-testid="save-ai-instructions-btn"
              >
                {savingInstructions ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Instructions
              </Button>
            </div>
          </TabsContent>
        )}

        {/* Blueprints Tab - Custom Intents & Angles */}
        {isAdmin && (
          <TabsContent value="blueprints" className="space-y-6">
            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Custom Intents
                </CardTitle>
                <CardDescription>
                  Create custom message intents for your blueprints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Intent name (e.g., product_launch)"
                    value={newIntent.name}
                    onChange={(e) => setNewIntent({ ...newIntent, name: e.target.value })}
                    className="flex-1"
                    data-testid="new-intent-name"
                  />
                  <Input
                    placeholder="Description"
                    value={newIntent.description}
                    onChange={(e) => setNewIntent({ ...newIntent, description: e.target.value })}
                    className="flex-1"
                    data-testid="new-intent-desc"
                  />
                  <Button
                    onClick={() => handleAddCustomOption("intent", newIntent)}
                    disabled={savingOption || !newIntent.name.trim()}
                    data-testid="add-intent-btn"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customOptions.intents?.map((intent, idx) => (
                    <Badge 
                      key={idx} 
                      variant={intent.is_custom ? "default" : "secondary"}
                      className="px-3 py-1.5"
                    >
                      {intent.name}
                      {intent.is_custom && (
                        <button
                          onClick={() => handleDeleteCustomOption(intent.id)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Custom Angles
                </CardTitle>
                <CardDescription>
                  Create custom message angles for your blueprints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Angle name (e.g., sustainability)"
                    value={newAngle.name}
                    onChange={(e) => setNewAngle({ ...newAngle, name: e.target.value })}
                    className="flex-1"
                    data-testid="new-angle-name"
                  />
                  <Input
                    placeholder="Description"
                    value={newAngle.description}
                    onChange={(e) => setNewAngle({ ...newAngle, description: e.target.value })}
                    className="flex-1"
                    data-testid="new-angle-desc"
                  />
                  <Button
                    onClick={() => handleAddCustomOption("angle", newAngle)}
                    disabled={savingOption || !newAngle.name.trim()}
                    data-testid="add-angle-btn"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customOptions.angles?.map((angle, idx) => (
                    <Badge 
                      key={idx} 
                      variant={angle.is_custom ? "default" : "secondary"}
                      className="px-3 py-1.5"
                    >
                      {angle.name}
                      {angle.is_custom && (
                        <button
                          onClick={() => handleDeleteCustomOption(angle.id)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Custom CTAs
                </CardTitle>
                <CardDescription>
                  Create custom call-to-action phrases for your messages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="CTA name (e.g., schedule_demo)"
                    value={newCta.name}
                    onChange={(e) => setNewCta({ ...newCta, name: e.target.value })}
                    className="flex-1"
                    data-testid="new-cta-name"
                  />
                  <Input
                    placeholder="CTA text (e.g., Would you like to see a demo?)"
                    value={newCta.description}
                    onChange={(e) => setNewCta({ ...newCta, description: e.target.value })}
                    className="flex-1"
                    data-testid="new-cta-desc"
                  />
                  <Button
                    onClick={() => handleAddCustomOption("cta", newCta)}
                    disabled={savingOption || !newCta.name.trim()}
                    data-testid="add-cta-btn"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customOptions.ctas?.map((cta, idx) => (
                    <Badge 
                      key={idx} 
                      variant={cta.is_custom ? "default" : "secondary"}
                      className="px-3 py-1.5"
                    >
                      {cta.name}
                      {cta.is_custom && (
                        <button
                          onClick={() => handleDeleteCustomOption(cta.id)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Integrations Tab */}
        {isAdmin && (
          <TabsContent value="integrations" className="space-y-6">
            <Card className="card-surface">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      WhatsApp Business Cloud API
                    </CardTitle>
                    <CardDescription>
                      Connect your WhatsApp Business account to send outreach messages
                    </CardDescription>
                  </div>
                  {whatsappConfig?.is_configured && (
                    <Badge className="status-safe">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {whatsappConfig?.is_configured ? (
                  <>
                    <Alert className="bg-green-500/10 border-green-500/30">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertTitle>WhatsApp is configured</AlertTitle>
                      <AlertDescription>
                        Phone Number ID: <code className="font-mono bg-muted px-1 rounded">{whatsappConfig.phone_number_id}</code>
                        {whatsappConfig.verified_at && (
                          <span className="text-xs ml-2">
                            (Verified: {new Date(whatsappConfig.verified_at).toLocaleDateString()})
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWhatsappConfig({ ...whatsappConfig, is_configured: false })}
                        data-testid="whatsapp-update-btn"
                      >
                        Update Credentials
                      </Button>
                      {isOwner && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteWhatsapp}
                          data-testid="whatsapp-delete-btn"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Alert className="bg-muted/50">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Setup Required</AlertTitle>
                      <AlertDescription className="text-sm">
                        To send WhatsApp messages, you need credentials from the Meta Business platform.{" "}
                        <a
                          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Get started with WhatsApp Cloud API
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="wa-phone-id">Phone Number ID</Label>
                        <Input
                          id="wa-phone-id"
                          placeholder="e.g., 123456789012345"
                          value={whatsappForm.phone_number_id}
                          onChange={(e) => setWhatsappForm({ ...whatsappForm, phone_number_id: e.target.value })}
                          disabled={!isOwner}
                          data-testid="whatsapp-phone-id-input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Found in Meta Developer Dashboard → WhatsApp → Getting Started
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="wa-access-token">Permanent Access Token</Label>
                        <div className="relative">
                          <Input
                            id="wa-access-token"
                            type={showAccessToken ? "text" : "password"}
                            placeholder="Enter your access token"
                            value={whatsappForm.access_token}
                            onChange={(e) => setWhatsappForm({ ...whatsappForm, access_token: e.target.value })}
                            disabled={!isOwner}
                            className="pr-10"
                            data-testid="whatsapp-access-token-input"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowAccessToken(!showAccessToken)}
                            data-testid="toggle-token-visibility"
                          >
                            {showAccessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Generate a permanent token in Meta Dashboard → System Users
                        </p>
                      </div>

                      {isOwner && (
                        <Button
                          onClick={handleSaveWhatsapp}
                          disabled={savingWhatsapp || !whatsappForm.phone_number_id || !whatsappForm.access_token}
                          data-testid="save-whatsapp-btn"
                        >
                          {savingWhatsapp ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Verify & Save Credentials
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Email Integration Placeholder */}
            <Card className="card-surface opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  AWS SES Email
                  <Badge variant="outline" className="ml-2">Coming Soon</Badge>
                </CardTitle>
                <CardDescription>
                  Connect AWS Simple Email Service for email outreach
                </CardDescription>
              </CardHeader>
            </Card>

            {/* LinkedIn Integration Placeholder */}
            <Card className="card-surface opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  LinkedIn
                  <Badge variant="outline" className="ml-2">Coming Soon</Badge>
                </CardTitle>
                <CardDescription>
                  Connect LinkedIn for company page post scheduling
                </CardDescription>
              </CardHeader>
            </Card>

            {/* IP Whitelist Configuration */}
            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  IP Whitelist
                </CardTitle>
                <CardDescription>
                  Configure allowed IP addresses for webhook callbacks and API access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Global IPs (read-only) */}
                <div>
                  <Label className="text-sm font-medium">Global Whitelisted IPs</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    System-level IPs that are always allowed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ipWhitelist.global_ips?.map((ip) => (
                      <Badge key={ip} variant="secondary" className="font-mono">
                        {ip}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Tenant-specific IPs */}
                <div>
                  <Label className="text-sm font-medium">Custom Whitelisted IPs</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Additional IPs you've added for your organization
                  </p>
                  {ipWhitelist.tenant_ips?.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {ipWhitelist.tenant_ips.map((ip) => (
                        <Badge key={ip} variant="outline" className="font-mono flex items-center gap-1">
                          {ip}
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveIp(ip)}
                              className="ml-1 hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-3">No custom IPs added</p>
                  )}

                  {/* Add IP form */}
                  {isOwner && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., 192.168.1.1"
                        value={newIpAddress}
                        onChange={(e) => setNewIpAddress(e.target.value)}
                        className="font-mono max-w-xs"
                        data-testid="new-ip-input"
                      />
                      <Button
                        onClick={handleAddIp}
                        disabled={savingIp || !newIpAddress.trim()}
                        data-testid="add-ip-btn"
                      >
                        {savingIp ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Add IP"
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Alert className="bg-muted/50">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>WarmReach Server:</strong> <code className="font-mono bg-background px-1 rounded">65.20.80.78</code> is pre-configured for webhook callbacks
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        )}

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
