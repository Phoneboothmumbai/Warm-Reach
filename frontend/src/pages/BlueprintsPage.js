import { useState, useEffect, useRef } from "react";
import { useAuth, API } from "@/App";
import {
  FileText,
  Plus,
  Mail,
  MessageCircle,
  Linkedin,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Copy,
  MoreHorizontal,
  Zap,
  AlertTriangle,
  Upload,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  X,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const channelConfig = {
  email: {
    icon: Mail,
    label: "Email",
    color: "channel-email",
    maxLines: "4-6 lines"
  },
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    color: "channel-whatsapp",
    maxLines: "3 lines"
  },
  linkedin: {
    icon: Linkedin,
    label: "LinkedIn",
    color: "channel-linkedin",
    maxLines: "Variable"
  }
};

const intentOptions = [
  { value: "awareness", label: "Awareness", description: "Introduce yourself and your value" },
  { value: "value", label: "Value", description: "Highlight specific value proposition" },
  { value: "follow_up", label: "Follow-up", description: "Continue previous contact" },
  { value: "nurture", label: "Nurture", description: "Build relationship over time" },
  { value: "reactivation", label: "Reactivation", description: "Re-engage dormant contacts" }
];

const angleOptions = [
  { value: "cost", label: "Cost", description: "Focus on cost savings" },
  { value: "risk", label: "Risk", description: "Highlight risk mitigation" },
  { value: "downtime", label: "Downtime", description: "Address downtime concerns" },
  { value: "growth", label: "Growth", description: "Emphasize growth potential" },
  { value: "compliance", label: "Compliance", description: "Focus on compliance needs" }
];

const toneOptions = [
  { value: "calm_authority", label: "Calm Authority", description: "Professional and confident" },
  { value: "observational", label: "Observational", description: "Insightful and analytical" },
  { value: "direct", label: "Direct", description: "Straightforward and clear" }
];

const messageLengthOptions = [
  { value: "short", label: "Short", description: "2-3 lines, very concise" },
  { value: "medium", label: "Medium", description: "4-6 lines, balanced" },
  { value: "long", label: "Long", description: "7-10 lines, detailed" }
];

const ctaOptions = [
  { value: "soft_question", label: "Soft Question", description: "Would you be open to..." },
  { value: "direct_ask", label: "Direct Ask", description: "Let's schedule a call" },
  { value: "value_offer", label: "Value Offer", description: "I'd be happy to share..." },
  { value: "no_cta", label: "No CTA", description: "No call-to-action" },
  { value: "custom", label: "Custom CTA", description: "Your own CTA text" }
];

export const BlueprintsPage = () => {
  const { authFetch, user } = useAuth();
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBlueprint, setEditBlueprint] = useState(null);
  const [channelFilter, setChannelFilter] = useState("all");
  const [selectedBlueprints, setSelectedBlueprints] = useState([]);
  
  // New dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [aiGenerateDialogOpen, setAiGenerateDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    channel: "email",
    intent: "awareness",
    angle: "cost",
    tone: "calm_authority",
    structure: "",
    cooldown_days: 7
  });

  const [aiForm, setAiForm] = useState({
    channel: "email",
    intent: "awareness",
    angle: "cost",
    tone: "calm_authority",
    industry: "",
    target_role: "",
    additional_context: "",
    message_length: "medium",
    cta_type: "soft_question",
    custom_cta: "",
    batch_mode: false,
    batch_channels: ["email"],
    batch_intents: ["awareness"],
    batch_angles: ["cost", "growth", "risk"]
  });

  // Custom options state
  const [customOptions, setCustomOptions] = useState({
    intents: [],
    angles: [],
    ctas: []
  });

  const canManageBlueprints = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    fetchBlueprints();
    fetchCustomOptions();
  }, [channelFilter]);

  const fetchCustomOptions = async () => {
    try {
      const response = await authFetch(`${API}/settings/custom-options`);
      if (response.ok) {
        const data = await response.json();
        setCustomOptions(data);
      }
    } catch (error) {
      console.error("Failed to load custom options:", error);
    }
  };

  const fetchBlueprints = async () => {
    setLoading(true);
    try {
      let url = `${API}/blueprints`;
      if (channelFilter !== "all") {
        url += `?channel=${channelFilter}`;
      }
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setBlueprints(data);
      }
    } catch (error) {
      toast.error("Failed to load blueprints");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlueprint = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch(`${API}/blueprints`, {
        method: "POST",
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        toast.success("Blueprint created successfully");
        setDialogOpen(false);
        resetForm();
        fetchBlueprints();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create blueprint");
      }
    } catch (error) {
      toast.error("Failed to create blueprint");
    }
  };

  const handleUpdateBlueprint = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch(`${API}/blueprints/${editBlueprint.id}`, {
        method: "PUT",
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        toast.success("Blueprint updated successfully");
        setEditBlueprint(null);
        resetForm();
        fetchBlueprints();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update blueprint");
      }
    } catch (error) {
      toast.error("Failed to update blueprint");
    }
  };

  const handleDeleteBlueprint = async (id) => {
    if (!confirm("Are you sure you want to delete this blueprint?")) return;
    try {
      const response = await authFetch(`${API}/blueprints/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        toast.success("Blueprint deleted");
        fetchBlueprints();
      }
    } catch (error) {
      toast.error("Failed to delete blueprint");
    }
  };

  const handleBulkDeleteBlueprints = async () => {
    if (selectedBlueprints.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedBlueprints.length} blueprint(s)?`)) return;
    try {
      const response = await authFetch(`${API}/blueprints/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ blueprint_ids: selectedBlueprints })
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Deleted ${result.deleted_count} blueprint(s)`);
        setSelectedBlueprints([]);
        fetchBlueprints();
      } else {
        toast.error("Failed to delete blueprints");
      }
    } catch (error) {
      toast.error("Failed to delete blueprints");
    }
  };

  const handleApproveBlueprint = async (id) => {
    try {
      const response = await authFetch(`${API}/blueprints/${id}/approve`, {
        method: "POST"
      });
      if (response.ok) {
        toast.success("Blueprint approved for use");
        fetchBlueprints();
      }
    } catch (error) {
      toast.error("Failed to approve blueprint");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedBlueprints.length === 0) return;
    try {
      const response = await authFetch(`${API}/blueprints/approve-bulk`, {
        method: "POST",
        body: JSON.stringify(selectedBlueprints)
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.approved_count} blueprint(s) approved`);
        setSelectedBlueprints([]);
        fetchBlueprints();
      }
    } catch (error) {
      toast.error("Failed to approve blueprints");
    }
  };

  const handleAIGenerate = async () => {
    setGenerating(true);
    setAiResult(null);
    
    try {
      let response;
      
      if (aiForm.batch_mode) {
        // Batch generation
        response = await authFetch(`${API}/blueprints/generate-batch-ai`, {
          method: "POST",
          body: JSON.stringify({
            channels: aiForm.batch_channels,
            intents: aiForm.batch_intents,
            angles: aiForm.batch_angles,
            tone: aiForm.tone,
            industry: aiForm.industry || null,
            target_role: aiForm.target_role || null,
            message_length: aiForm.message_length,
            cta_type: aiForm.cta_type,
            custom_cta: aiForm.cta_type === "custom" ? aiForm.custom_cta : null
          })
        });
      } else {
        // Single generation
        response = await authFetch(`${API}/blueprints/generate-ai`, {
          method: "POST",
          body: JSON.stringify({
            channel: aiForm.channel,
            intent: aiForm.intent,
            angle: aiForm.angle,
            tone: aiForm.tone,
            industry: aiForm.industry || null,
            target_role: aiForm.target_role || null,
            additional_context: aiForm.additional_context || null,
            message_length: aiForm.message_length,
            cta_type: aiForm.cta_type,
            custom_cta: aiForm.cta_type === "custom" ? aiForm.custom_cta : null
          })
        });
      }

      if (response.ok) {
        const result = await response.json();
        setAiResult(result);
        
        if (aiForm.batch_mode) {
          toast.success(`Generated ${result.generated_count} blueprint(s)!`);
        } else {
          toast.success("Blueprint generated! Review and approve to use.");
        }
        
        fetchBlueprints();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to generate blueprint");
      }
    } catch (error) {
      toast.error("Failed to generate blueprint");
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await authFetch(`${API}/blueprints/import`, {
        method: "POST",
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Imported ${result.imported} blueprints. They need approval before use.`);
        setImportDialogOpen(false);
        fetchBlueprints();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Import failed");
      }
    } catch (error) {
      toast.error("Import failed");
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await authFetch(`${API}/blueprints/import/template`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blueprint_template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Template downloaded!");
      } else {
        toast.error("Failed to download template");
      }
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      channel: "email",
      intent: "awareness",
      angle: "cost",
      tone: "calm_authority",
      structure: "",
      cooldown_days: 7
    });
  };

  const openEditDialog = (blueprint) => {
    setFormData({
      name: blueprint.name || "",
      description: blueprint.description || "",
      channel: blueprint.channel || "email",
      intent: blueprint.intent || "awareness",
      angle: blueprint.angle || "cost",
      tone: blueprint.tone || "calm_authority",
      structure: blueprint.structure || "",
      cooldown_days: blueprint.cooldown_days || 7
    });
    setEditBlueprint(blueprint);
  };

  const toggleBlueprintSelection = (id) => {
    setSelectedBlueprints(prev =>
      prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]
    );
  };

  const unapprovedBlueprints = blueprints.filter(b => !b.is_approved);

  const getPlaceholderText = () => {
    if (formData.channel === "email") {
      return `Hi {{first_name}},

I noticed {{company_name}} has been growing quickly. Many companies at this stage face [problem related to ${formData.angle}].

Would it be worth a quick chat to explore how we might help?

Best regards`;
    } else if (formData.channel === "whatsapp") {
      return `Hi {{first_name}}, noticed {{company_name}}'s growth. Have you considered [${formData.angle} angle]?

Reply STOP to opt out.`;
    } else {
      return `[Thought-leadership post about ${formData.angle}]

Share your perspective on [industry trend].

No links in first post.`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-2" data-testid="blueprints-heading">Message Blueprints</h1>
          <p className="text-muted-foreground">
            Create, import, or AI-generate message templates
          </p>
        </div>
        {canManageBlueprints && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
              data-testid="import-blueprints-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAiResult(null);
                setAiGenerateDialogOpen(true);
              }}
              data-testid="ai-generate-btn"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generate
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              data-testid="create-blueprint-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Manual
            </Button>
          </div>
        )}
      </div>

      {/* Pending Approval Banner */}
      {unapprovedBlueprints.length > 0 && (
        <Card className="card-surface border-yellow-500/30 bg-yellow-500/5" data-testid="pending-approval-banner">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">{unapprovedBlueprints.length} blueprint(s) pending approval</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedBlueprints.length > 0 
                      ? `${selectedBlueprints.length} selected` 
                      : "Approve blueprints before they can be used for message generation"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedBlueprints.length === unapprovedBlueprints.length) {
                      setSelectedBlueprints([]);
                    } else {
                      setSelectedBlueprints(unapprovedBlueprints.map(b => b.id));
                    }
                  }}
                  data-testid="select-all-unapproved-btn"
                >
                  {selectedBlueprints.length === unapprovedBlueprints.length ? (
                    <><CheckSquare className="w-4 h-4 mr-2" /> Deselect All</>
                  ) : (
                    <><Square className="w-4 h-4 mr-2" /> Select All</>
                  )}
                </Button>
                {selectedBlueprints.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleBulkDeleteBlueprints}
                    className="text-destructive hover:bg-destructive/10"
                    data-testid="bulk-delete-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedBlueprints.length})
                  </Button>
                )}
                <Button
                  onClick={handleBulkApprove}
                  disabled={selectedBlueprints.length === 0}
                  data-testid="bulk-approve-btn"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve ({selectedBlueprints.length || unapprovedBlueprints.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={channelFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setChannelFilter("all")}
          data-testid="filter-all-btn"
        >
          All Channels
        </Button>
        {Object.entries(channelConfig).map(([key, config]) => (
          <Button
            key={key}
            variant={channelFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setChannelFilter(key)}
            data-testid={`filter-${key}-btn`}
          >
            <config.icon className="w-4 h-4 mr-2" />
            {config.label}
          </Button>
        ))}
      </div>

      {/* Blueprints Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : blueprints.length === 0 ? (
        <Card className="card-surface">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No blueprints yet</h3>
            <p className="text-muted-foreground mb-4">
              Create manually, import from CSV, or let AI generate blueprints for you
            </p>
            {canManageBlueprints && (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setAiGenerateDialogOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generate
                </Button>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Manual
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((blueprint) => {
            const config = channelConfig[blueprint.channel];
            const ChannelIcon = config?.icon || Mail;
            const isSelected = selectedBlueprints.includes(blueprint.id);
            
            return (
              <Card
                key={blueprint.id}
                className={cn(
                  "card-surface group",
                  !blueprint.is_approved && "border-yellow-500/30",
                  isSelected && "bg-primary/5 border-primary"
                )}
                data-testid={`blueprint-card-${blueprint.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {!blueprint.is_approved && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleBlueprintSelection(blueprint.id)}
                          data-testid={`blueprint-checkbox-${blueprint.id}`}
                        />
                      )}
                      <div className={cn("channel-badge", config?.color)}>
                        <ChannelIcon className="w-3.5 h-3.5" />
                        {config?.label}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {blueprint.is_approved ? (
                        <Badge className="status-safe text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {canManageBlueprints && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`blueprint-menu-${blueprint.id}`}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(blueprint)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {!blueprint.is_approved && (
                              <DropdownMenuItem onClick={() => handleApproveBlueprint(blueprint.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(blueprint.structure);
                              toast.success("Structure copied to clipboard");
                            }}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Structure
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteBlueprint(blueprint.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-2">{blueprint.name}</CardTitle>
                  {blueprint.description && (
                    <CardDescription className="line-clamp-2">
                      {blueprint.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      {blueprint.intent?.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {blueprint.angle}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {blueprint.tone?.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <pre className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap font-mono">
                      {blueprint.structure}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {blueprint.cooldown_days}d cooldown
                    </div>
                    <div>
                      Used {blueprint.usage_count || 0} times
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen || !!editBlueprint} onOpenChange={(open) => {
        if (!open) {
          setDialogOpen(false);
          setEditBlueprint(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBlueprint ? "Edit Blueprint" : "Create New Blueprint"}</DialogTitle>
            <DialogDescription>
              Design a reusable message structure with clear intent and angle
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editBlueprint ? handleUpdateBlueprint : handleCreateBlueprint}>
            <div className="grid gap-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Blueprint Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Cold Intro - Cost Focus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="blueprint-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel *</Label>
                  <Select
                    value={formData.channel}
                    onValueChange={(value) => setFormData({ ...formData, channel: value })}
                  >
                    <SelectTrigger data-testid="blueprint-channel-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(channelConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="w-4 h-4" />
                            {config.label}
                            <span className="text-xs text-muted-foreground">
                              ({config.maxLines})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of when to use this blueprint"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="blueprint-description-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Intent *</Label>
                  <Select
                    value={formData.intent}
                    onValueChange={(value) => setFormData({ ...formData, intent: value })}
                  >
                    <SelectTrigger data-testid="blueprint-intent-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(customOptions.intents?.length > 0 ? customOptions.intents : intentOptions).map((option) => (
                        <SelectItem key={option.name || option.value} value={option.name || option.value}>
                          {option.name || option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Angle *</Label>
                  <Select
                    value={formData.angle}
                    onValueChange={(value) => setFormData({ ...formData, angle: value })}
                  >
                    <SelectTrigger data-testid="blueprint-angle-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(customOptions.angles?.length > 0 ? customOptions.angles : angleOptions).map((option) => (
                        <SelectItem key={option.name || option.value} value={option.name || option.value}>
                          {option.name || option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tone *</Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(value) => setFormData({ ...formData, tone: value })}
                  >
                    <SelectTrigger data-testid="blueprint-tone-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="structure">Message Structure *</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Use placeholders: {"{{first_name}}, {{last_name}}, {{company_name}}, {{job_title}}"}
                </div>
                <Textarea
                  id="structure"
                  placeholder={getPlaceholderText()}
                  value={formData.structure}
                  onChange={(e) => setFormData({ ...formData, structure: e.target.value })}
                  rows={8}
                  required
                  className="font-mono text-sm"
                  data-testid="blueprint-structure-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown">Cooldown Period (days)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={1}
                  max={90}
                  value={formData.cooldown_days}
                  onChange={(e) => setFormData({ ...formData, cooldown_days: parseInt(e.target.value) || 7 })}
                  className="w-32"
                  data-testid="blueprint-cooldown-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" data-testid="blueprint-submit-btn">
                {editBlueprint ? "Update Blueprint" : "Create Blueprint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Blueprints from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple blueprints at once
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="mb-2">Drag and drop your CSV file here, or</p>
              <label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="hidden"
                  data-testid="csv-file-input"
                />
                <Button variant="secondary" asChild>
                  <span className="cursor-pointer">Browse Files</span>
                </Button>
              </label>
              <div className="text-xs text-muted-foreground mt-4 text-left">
                <p className="font-medium mb-2">Required columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>name - Blueprint name</li>
                  <li>channel - email, whatsapp, or linkedin</li>
                  <li>structure - The message template</li>
                </ul>
                <p className="font-medium mt-3 mb-2">Optional columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>intent - awareness, conversation, follow_up</li>
                  <li>angle - cost, risk, downtime, growth, compliance</li>
                  <li>tone - calm_authority, observational, direct</li>
                  <li>description, cooldown_days</li>
                </ul>
                <p className="mt-3 text-yellow-600 dark:text-yellow-400">
                  Note: Imported blueprints require approval before use
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="mt-2"
                data-testid="download-template-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Sample CSV Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiGenerateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setAiGenerateDialogOpen(false);
          setAiResult(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Blueprint Generator
            </DialogTitle>
            <DialogDescription>
              Let AI create professional outreach blueprints based on your specifications
            </DialogDescription>
          </DialogHeader>

          {!aiResult ? (
            <>
              <div className="space-y-4 py-4">
                {/* Batch Mode Toggle */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="batch-mode"
                    checked={aiForm.batch_mode}
                    onCheckedChange={(checked) => setAiForm({ ...aiForm, batch_mode: checked })}
                    data-testid="ai-batch-mode-checkbox"
                  />
                  <div className="flex-1">
                    <Label htmlFor="batch-mode" className="font-medium cursor-pointer">
                      Batch Generation Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Generate multiple blueprints for different channel/intent/angle combinations
                    </p>
                  </div>
                </div>

                {!aiForm.batch_mode ? (
                  /* Single Blueprint Generation */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Channel</Label>
                        <Select
                          value={aiForm.channel}
                          onValueChange={(value) => setAiForm({ ...aiForm, channel: value })}
                        >
                          <SelectTrigger data-testid="ai-channel-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(channelConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <config.icon className="w-4 h-4" />
                                  {config.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Intent</Label>
                        <Select
                          value={aiForm.intent}
                          onValueChange={(value) => setAiForm({ ...aiForm, intent: value })}
                        >
                          <SelectTrigger data-testid="ai-intent-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(customOptions.intents?.length > 0 ? customOptions.intents : intentOptions).map((opt) => (
                              <SelectItem key={opt.name || opt.value} value={opt.name || opt.value}>
                                {opt.name || opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Angle</Label>
                        <Select
                          value={aiForm.angle}
                          onValueChange={(value) => setAiForm({ ...aiForm, angle: value })}
                        >
                          <SelectTrigger data-testid="ai-angle-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(customOptions.angles?.length > 0 ? customOptions.angles : angleOptions).map((opt) => (
                              <SelectItem key={opt.name || opt.value} value={opt.name || opt.value}>
                                {opt.name || opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tone</Label>
                        <Select
                          value={aiForm.tone}
                          onValueChange={(value) => setAiForm({ ...aiForm, tone: value })}
                        >
                          <SelectTrigger data-testid="ai-tone-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Batch Generation Options */
                  <>
                    <div className="space-y-2">
                      <Label>Channels (select multiple)</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(channelConfig).map(([key, config]) => (
                          <Button
                            key={key}
                            type="button"
                            variant={aiForm.batch_channels.includes(key) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const newChannels = aiForm.batch_channels.includes(key)
                                ? aiForm.batch_channels.filter(c => c !== key)
                                : [...aiForm.batch_channels, key];
                              setAiForm({ ...aiForm, batch_channels: newChannels });
                            }}
                          >
                            <config.icon className="w-4 h-4 mr-1" />
                            {config.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Intents (select multiple)</Label>
                      <div className="flex flex-wrap gap-2">
                        {(customOptions.intents?.length > 0 ? customOptions.intents : intentOptions).map((opt) => (
                          <Button
                            key={opt.name || opt.value}
                            type="button"
                            variant={aiForm.batch_intents.includes(opt.name || opt.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const val = opt.name || opt.value;
                              const newIntents = aiForm.batch_intents.includes(val)
                                ? aiForm.batch_intents.filter(i => i !== val)
                                : [...aiForm.batch_intents, val];
                              setAiForm({ ...aiForm, batch_intents: newIntents });
                            }}
                          >
                            {opt.name || opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Angles (select multiple)</Label>
                      <div className="flex flex-wrap gap-2">
                        {(customOptions.angles?.length > 0 ? customOptions.angles : angleOptions).map((opt) => (
                          <Button
                            key={opt.name || opt.value}
                            type="button"
                            variant={aiForm.batch_angles.includes(opt.name || opt.value) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const val = opt.name || opt.value;
                              const newAngles = aiForm.batch_angles.includes(val)
                                ? aiForm.batch_angles.filter(a => a !== val)
                                : [...aiForm.batch_angles, val];
                              setAiForm({ ...aiForm, batch_angles: newAngles });
                            }}
                          >
                            {opt.name || opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      Will generate: <strong>{aiForm.batch_channels.length} × {aiForm.batch_intents.length} × {aiForm.batch_angles.length} = {aiForm.batch_channels.length * aiForm.batch_intents.length * aiForm.batch_angles.length}</strong> blueprints
                    </div>
                  </>
                )}

                {/* Common fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Industry (optional)</Label>
                    <Input
                      placeholder="e.g., SaaS, Healthcare, Finance"
                      value={aiForm.industry}
                      onChange={(e) => setAiForm({ ...aiForm, industry: e.target.value })}
                      data-testid="ai-industry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Role (optional)</Label>
                    <Input
                      placeholder="e.g., CTO, VP Engineering"
                      value={aiForm.target_role}
                      onChange={(e) => setAiForm({ ...aiForm, target_role: e.target.value })}
                      data-testid="ai-role-input"
                    />
                  </div>
                </div>

                {/* Message Length and CTA Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Message Length</Label>
                    <Select
                      value={aiForm.message_length}
                      onValueChange={(v) => setAiForm({ ...aiForm, message_length: v })}
                    >
                      <SelectTrigger data-testid="ai-length-select">
                        <SelectValue placeholder="Select length" />
                      </SelectTrigger>
                      <SelectContent>
                        {messageLengthOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col">
                              <span>{opt.label}</span>
                              <span className="text-xs text-muted-foreground">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Call-to-Action</Label>
                    <Select
                      value={aiForm.cta_type}
                      onValueChange={(v) => setAiForm({ ...aiForm, cta_type: v })}
                    >
                      <SelectTrigger data-testid="ai-cta-select">
                        <SelectValue placeholder="Select CTA" />
                      </SelectTrigger>
                      <SelectContent>
                        {(customOptions.ctas?.length > 0 ? customOptions.ctas : ctaOptions).map((opt) => (
                          <SelectItem key={opt.value || opt.name} value={opt.value || opt.name}>
                            <div className="flex flex-col">
                              <span>{opt.label || opt.name}</span>
                              <span className="text-xs text-muted-foreground">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {aiForm.cta_type === "custom" && (
                  <div className="space-y-2">
                    <Label>Custom CTA Text</Label>
                    <Input
                      placeholder="Enter your custom call-to-action text"
                      value={aiForm.custom_cta}
                      onChange={(e) => setAiForm({ ...aiForm, custom_cta: e.target.value })}
                      data-testid="ai-custom-cta-input"
                    />
                  </div>
                )}

                {!aiForm.batch_mode && (
                  <div className="space-y-2">
                    <Label>Additional Context (optional)</Label>
                    <Textarea
                      placeholder="Any specific requirements or context for the message..."
                      value={aiForm.additional_context}
                      onChange={(e) => setAiForm({ ...aiForm, additional_context: e.target.value })}
                      rows={3}
                      data-testid="ai-context-input"
                    />
                  </div>
                )}

                <div className="p-3 bg-yellow-500/10 rounded-lg text-sm text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>AI-generated blueprints require your approval before they can be used for message generation.</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAiGenerateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAIGenerate}
                  disabled={generating || (aiForm.batch_mode && (aiForm.batch_channels.length === 0 || aiForm.batch_intents.length === 0 || aiForm.batch_angles.length === 0))}
                  data-testid="ai-generate-submit"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {aiForm.batch_mode ? "Generate Batch" : "Generate Blueprint"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* AI Result */
            <>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-secondary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                    <span className="font-semibold">
                      {aiForm.batch_mode 
                        ? `${aiResult.generated_count} Blueprint(s) Generated!`
                        : "Blueprint Generated!"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Review the generated blueprint(s) and approve to use for message generation
                  </p>
                </div>

                {aiForm.batch_mode ? (
                  /* Batch result */
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {aiResult.blueprints?.map((bp, i) => (
                        <div key={i} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs capitalize">{bp.channel}</Badge>
                            <span className="font-medium text-sm">{bp.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {bp.intent} • {bp.angle}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  /* Single result */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Generated Blueprint</Label>
                      <Badge variant="outline">{aiResult.blueprint?.name}</Badge>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {aiResult.blueprint?.structure}
                      </pre>
                    </div>
                  </div>
                )}

                {aiResult.errors?.length > 0 && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
                    <ul className="text-xs text-destructive space-y-1">
                      {aiResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAiResult(null)}
                >
                  Generate More
                </Button>
                <Button onClick={() => {
                  setAiGenerateDialogOpen(false);
                  setAiResult(null);
                }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
