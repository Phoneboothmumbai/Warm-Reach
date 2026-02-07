import { useState, useEffect } from "react";
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
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  { value: "conversation", label: "Conversation", description: "Start a dialogue" },
  { value: "follow_up", label: "Follow-up", description: "Continue previous contact" }
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

export const BlueprintsPage = () => {
  const { authFetch, user } = useAuth();
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBlueprint, setEditBlueprint] = useState(null);
  const [channelFilter, setChannelFilter] = useState("all");

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

  const canManageBlueprints = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    fetchBlueprints();
  }, [channelFilter]);

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

  const handleApproveBlueprint = async (id) => {
    try {
      const response = await authFetch(`${API}/blueprints/${id}/approve`, {
        method: "POST"
      });
      if (response.ok) {
        toast.success("Blueprint approved for auto-send");
        fetchBlueprints();
      }
    } catch (error) {
      toast.error("Failed to approve blueprint");
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
            Create reusable message structures with intent and angle
          </p>
        </div>
        {canManageBlueprints && (
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            data-testid="create-blueprint-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Blueprint
          </Button>
        )}
      </div>

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
              Create your first message blueprint to start generating outreach
            </p>
            {canManageBlueprints && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Blueprint
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((blueprint) => {
            const config = channelConfig[blueprint.channel];
            const ChannelIcon = config?.icon || Mail;
            
            return (
              <Card
                key={blueprint.id}
                className="card-surface group"
                data-testid={`blueprint-card-${blueprint.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={cn("channel-badge", config?.color)}>
                      <ChannelIcon className="w-3.5 h-3.5" />
                      {config?.label}
                    </div>
                    <div className="flex items-center gap-1">
                      {blueprint.is_approved && (
                        <Badge className="status-safe text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Auto-approved
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
                                Approve for Auto-send
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
                      {intentOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                      {angleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                {formData.channel === "email" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    Email: Plain text only, 4-6 lines max, no emojis, no links in first touch
                  </p>
                )}
                {formData.channel === "whatsapp" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    WhatsApp: Max 3 lines, mandatory opt-out line, conversational tone
                  </p>
                )}
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
                <p className="text-xs text-muted-foreground">
                  Minimum days before this blueprint can be reused for the same contact
                </p>
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
    </div>
  );
};
