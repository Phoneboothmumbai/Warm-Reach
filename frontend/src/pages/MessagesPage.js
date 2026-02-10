import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import {
  MessageSquare,
  Mail,
  MessageCircle,
  Linkedin,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Edit,
  RefreshCw,
  Calendar,
  Filter,
  Zap,
  Trash2,
  CheckSquare,
  Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground border-border" },
  pending_approval: { label: "Pending Approval", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  approved: { label: "Approved", color: "bg-primary/15 text-primary border-primary/20" },
  scheduled: { label: "Scheduled", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  sent: { label: "Sent", color: "bg-secondary/15 text-secondary border-secondary/20" },
  delivered: { label: "Delivered", color: "bg-secondary/15 text-secondary border-secondary/20" },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive border-destructive/20" },
  bounced: { label: "Bounced", color: "bg-destructive/15 text-destructive border-destructive/20" }
};

const channelIcons = {
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin
};

export const MessagesPage = () => {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [bulkScheduleDialogOpen, setBulkScheduleDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  
  const [batchForm, setBatchForm] = useState({
    channel: "",
    max_messages: 10,
    blueprint_id: ""
  });

  const [editedContent, setEditedContent] = useState("");
  const [selectedMessages, setSelectedMessages] = useState([]);
  
  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    time: "",
    interval: 5
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter, channelFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API}/messages?limit=100`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (channelFilter !== "all") {
        url += `&channel=${channelFilter}`;
      }

      const [messagesRes, contactsRes, blueprintsRes] = await Promise.all([
        authFetch(url),
        authFetch(`${API}/contacts?limit=200`),
        authFetch(`${API}/blueprints`)
      ]);

      if (messagesRes.ok) setMessages(await messagesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (blueprintsRes.ok) setBlueprints(await blueprintsRes.json());
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    setGenerating(true);
    setBatchResult(null);
    
    try {
      const payload = {
        max_messages: batchForm.max_messages
      };
      
      if (batchForm.channel) {
        payload.channel = batchForm.channel;
      }
      if (batchForm.blueprint_id) {
        payload.blueprint_id = batchForm.blueprint_id;
      }

      const response = await authFetch(`${API}/messages/generate-batch`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setBatchResult(result);
        
        if (result.generated_count > 0) {
          toast.success(`Generated ${result.generated_count} unique messages!`);
        } else if (result.skipped_count > 0) {
          toast.warning(`No new messages generated. ${result.skipped_count} contacts skipped (already contacted this month or no matching blueprints).`);
        } else {
          toast.warning("No messages could be generated. Check contacts and blueprints.");
        }
        
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to generate messages");
      }
    } catch (error) {
      console.error("Generate error:", error);
      toast.error("Failed to generate messages. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveMessages = async (messageIds) => {
    try {
      const response = await authFetch(`${API}/messages/approve`, {
        method: "POST",
        body: JSON.stringify({ message_ids: messageIds })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.approved_count} message(s) approved`);
        setSelectedMessages([]);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to approve messages");
      }
    } catch (error) {
      toast.error("Failed to approve messages");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const response = await authFetch(`${API}/messages/${messageId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success("Message deleted");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to delete message");
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleBulkDeleteMessages = async (messageIds) => {
    if (!confirm(`Are you sure you want to delete ${messageIds.length} message(s)?`)) return;
    try {
      let deleted = 0;
      for (const id of messageIds) {
        const response = await authFetch(`${API}/messages/${id}`, {
          method: "DELETE"
        });
        if (response.ok) deleted++;
      }
      toast.success(`Deleted ${deleted} message(s)`);
      setSelectedMessages([]);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete messages");
    }
  };

  const handleUpdateContent = async () => {
    if (!selectedMessage) return;

    try {
      const response = await authFetch(
        `${API}/messages/${selectedMessage.id}/content?content=${encodeURIComponent(editedContent)}`,
        { method: "PUT" }
      );

      if (response.ok) {
        toast.success("Message content updated");
        setEditDialogOpen(false);
        setSelectedMessage(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update message");
      }
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const handleScheduleMessage = async () => {
    if (!selectedMessage || !scheduleForm.date || !scheduleForm.time) {
      toast.error("Please select date and time");
      return;
    }

    try {
      const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString();
      const response = await authFetch(
        `${API}/messages/${selectedMessage.id}/reschedule?scheduled_at=${encodeURIComponent(scheduledAt)}`,
        { method: "PUT" }
      );

      if (response.ok) {
        toast.success("Message scheduled");
        setScheduleDialogOpen(false);
        setSelectedMessage(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to schedule message");
      }
    } catch (error) {
      toast.error("Failed to schedule message");
    }
  };

  const handleBulkSchedule = async () => {
    if (selectedMessages.length === 0) {
      toast.error("No messages selected");
      return;
    }
    if (!scheduleForm.date || !scheduleForm.time) {
      toast.error("Please select date and time");
      return;
    }

    try {
      const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString();
      const response = await authFetch(`${API}/messages/schedule-bulk`, {
        method: "POST",
        body: JSON.stringify({
          message_ids: selectedMessages,
          scheduled_at: scheduledAt,
          interval_minutes: scheduleForm.interval || 5
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Scheduled ${result.scheduled_count} message(s)`);
        setBulkScheduleDialogOpen(false);
        setSelectedMessages([]);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to schedule messages");
      }
    } catch (error) {
      toast.error("Failed to schedule messages");
    }
  };

  const handleUnschedule = async (messageId) => {
    try {
      const response = await authFetch(`${API}/messages/${messageId}/unschedule`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success("Schedule removed");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to remove schedule");
      }
    } catch (error) {
      toast.error("Failed to remove schedule");
    }
  };

  const openScheduleDialog = (message) => {
    setSelectedMessage(message);
    // Pre-fill with existing schedule if available
    if (message.scheduled_at) {
      const dt = new Date(message.scheduled_at);
      setScheduleForm({
        date: dt.toISOString().split('T')[0],
        time: dt.toTimeString().slice(0, 5),
        interval: 5
      });
    } else {
      // Default to tomorrow at 10:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleForm({
        date: tomorrow.toISOString().split('T')[0],
        time: "10:00",
        interval: 5
      });
    }
    setScheduleDialogOpen(true);
  };

  const openBulkScheduleDialog = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleForm({
      date: tomorrow.toISOString().split('T')[0],
      time: "10:00",
      interval: 5
    });
    setBulkScheduleDialogOpen(true);
  };

  const openEditDialog = (message) => {
    setSelectedMessage(message);
    setEditedContent(message.content);
    setEditDialogOpen(true);
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.first_name} ${contact.last_name}` : "Unknown";
  };

  const getContactEmail = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.email || "";
  };

  const getBlueprintName = (blueprintId) => {
    const blueprint = blueprints.find(b => b.id === blueprintId);
    return blueprint?.name || "Unknown";
  };

  const pendingMessages = messages.filter(m => m.status === "pending_approval");
  
  const toggleMessageSelection = (messageId) => {
    setSelectedMessages(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  };

  const toggleAllPending = () => {
    if (selectedMessages.length === pendingMessages.length) {
      setSelectedMessages([]);
    } else {
      setSelectedMessages(pendingMessages.map(m => m.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-2" data-testid="messages-heading">Messages</h1>
          <p className="text-muted-foreground">
            Auto-generate unique messages in batch, then review and approve
          </p>
        </div>
        <Button 
          onClick={() => {
            setBatchResult(null);
            setBatchDialogOpen(true);
          }} 
          data-testid="batch-generate-btn"
          className="bg-primary hover:bg-primary/90"
        >
          <Zap className="w-4 h-4 mr-2" />
          Generate Batch
        </Button>
      </div>

      {/* Pending Approval Banner */}
      {pendingMessages.length > 0 && (
        <Card className="card-surface border-yellow-500/30 bg-yellow-500/5" data-testid="pending-approval-banner">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">{pendingMessages.length} message(s) pending approval</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMessages.length > 0 
                      ? `${selectedMessages.length} selected` 
                      : "Select messages or approve all"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllPending}
                  data-testid="select-all-pending-btn"
                >
                  {selectedMessages.length === pendingMessages.length ? (
                    <><CheckSquare className="w-4 h-4 mr-2" /> Deselect All</>
                  ) : (
                    <><Square className="w-4 h-4 mr-2" /> Select All</>
                  )}
                </Button>
                {selectedMessages.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkDeleteMessages(selectedMessages)}
                      className="text-destructive hover:bg-destructive/10"
                      data-testid="delete-selected-btn"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedMessages.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openBulkScheduleDialog}
                      className="text-blue-600 hover:bg-blue-500/10"
                      data-testid="schedule-selected-btn"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule ({selectedMessages.length})
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => handleApproveMessages(
                    selectedMessages.length > 0 ? selectedMessages : pendingMessages.map(m => m.id)
                  )}
                  data-testid="approve-selected-btn"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {selectedMessages.length > 0 
                    ? `Approve (${selectedMessages.length})`
                    : "Approve All"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="message-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-40" data-testid="message-channel-filter">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={fetchData} data-testid="refresh-messages-btn">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages List */}
      <Card className="card-surface">
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-muted-foreground mb-4">
                Click "Generate Batch" to automatically create unique messages<br />
                for your eligible contacts
              </p>
              <Button onClick={() => setBatchDialogOpen(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Generate Batch
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((message) => {
                const ChannelIcon = channelIcons[message.channel] || Mail;
                const statusCfg = statusConfig[message.status] || statusConfig.draft;
                const canEdit = ["draft", "pending_approval"].includes(message.status);
                const isPending = message.status === "pending_approval";
                const isSelected = selectedMessages.includes(message.id);

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "p-4 hover:bg-muted/30 transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                    data-testid={`message-row-${message.id}`}
                  >
                    <div className="flex items-start gap-4">
                      {isPending && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMessageSelection(message.id)}
                          className="mt-3"
                          data-testid={`message-checkbox-${message.id}`}
                        />
                      )}
                      
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        message.channel === "email" && "bg-primary/10 text-primary",
                        message.channel === "whatsapp" && "bg-green-500/10 text-green-600 dark:text-green-400",
                        message.channel === "linkedin" && "bg-blue-600/10 text-blue-600 dark:text-blue-400"
                      )}>
                        <ChannelIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium">{getContactName(message.contact_id)}</span>
                          <span className="text-sm text-muted-foreground">
                            {getContactEmail(message.contact_id)}
                          </span>
                          <Badge className={cn("text-xs border ml-auto", statusCfg.color)}>
                            {statusCfg.label}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          Blueprint: {getBlueprintName(message.blueprint_id)} • {message.channel}
                        </p>

                        <div className="p-3 bg-muted/30 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap font-sans line-clamp-4">
                            {message.content}
                          </pre>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Created: {new Date(message.created_at).toLocaleString()}</span>
                          {message.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Scheduled: {new Date(message.scheduled_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0 flex-wrap">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(message)}
                            data-testid={`edit-message-${message.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Schedule/Reschedule button - show for pending, approved, scheduled */}
                        {["pending_approval", "approved", "scheduled"].includes(message.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openScheduleDialog(message)}
                            className="text-blue-600 hover:bg-blue-500/10"
                            data-testid={`schedule-message-${message.id}`}
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Unschedule button - only for scheduled messages */}
                        {message.status === "scheduled" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnschedule(message.id)}
                            className="text-orange-600 hover:bg-orange-500/10"
                            data-testid={`unschedule-message-${message.id}`}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-destructive hover:bg-destructive/10"
                          data-testid={`delete-message-${message.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {isPending && !isSelected && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveMessages([message.id])}
                            data-testid={`approve-message-${message.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Batch Generate Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Generate Message Batch
            </DialogTitle>
            <DialogDescription>
              Automatically generate unique AI-powered messages for your eligible contacts
            </DialogDescription>
          </DialogHeader>

          {!batchResult ? (
            <>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                  <p className="text-sm font-medium">How it works:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• System selects eligible contacts (not blacklisted, not in cooldown)</li>
                    <li>• AI generates unique message for each contact using blueprints</li>
                    <li>• Each message is different - no duplicates</li>
                    <li>• You just review and approve with one click</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label>Number of Messages</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={batchForm.max_messages}
                    onChange={(e) => setBatchForm({ ...batchForm, max_messages: parseInt(e.target.value) || 10 })}
                    data-testid="batch-max-messages"
                  />
                  <p className="text-xs text-muted-foreground">
                    Max messages to generate (respects rate limits)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Channel (Optional)</Label>
                  <Select
                    value={batchForm.channel || "all"}
                    onValueChange={(value) => setBatchForm({ ...batchForm, channel: value === "all" ? "" : value })}
                  >
                    <SelectTrigger data-testid="batch-channel-select">
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="email">Email Only</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                      <SelectItem value="linkedin">LinkedIn Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Blueprint (Optional)</Label>
                  <Select
                    value={batchForm.blueprint_id || "auto"}
                    onValueChange={(value) => setBatchForm({ ...batchForm, blueprint_id: value === "auto" ? "" : value })}
                  >
                    <SelectTrigger data-testid="batch-blueprint-select">
                      <SelectValue placeholder="Auto-select blueprints" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-select blueprints</SelectItem>
                      {blueprints.map((bp) => (
                        <SelectItem key={bp.id} value={bp.id}>
                          {bp.name} ({bp.channel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchGenerate}
                  disabled={generating || blueprints.length === 0}
                  data-testid="batch-generate-submit"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Messages
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className={cn(
                  "p-4 rounded-lg",
                  batchResult.generated_count > 0 ? "bg-secondary/10" : "bg-yellow-500/10"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {batchResult.generated_count > 0 ? (
                      <CheckCircle className="w-5 h-5 text-secondary" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    )}
                    <span className="font-semibold">
                      {batchResult.generated_count > 0 
                        ? `${batchResult.generated_count} Messages Generated!`
                        : "No Messages Generated"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {batchResult.skipped_count > 0 && `${batchResult.skipped_count} contacts skipped (cooldown/existing)`}
                  </p>
                </div>

                {batchResult.messages && batchResult.messages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Generated Messages Preview</Label>
                    <ScrollArea className="h-64 border rounded-lg">
                      <div className="divide-y divide-border">
                        {batchResult.messages.map((msg, i) => (
                          <div key={i} className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {msg.channel}
                              </Badge>
                              <span className="font-medium text-sm">{msg.contact_name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{msg.contact_email}</p>
                            <p className="text-sm line-clamp-2">{msg.content_preview}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {batchResult.errors && batchResult.errors.length > 0 && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
                    <ul className="text-xs text-destructive space-y-1">
                      {batchResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchResult(null);
                  }}
                >
                  Generate More
                </Button>
                <Button
                  onClick={() => {
                    setBatchDialogOpen(false);
                    setBatchResult(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setSelectedMessage(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Message Content</DialogTitle>
            <DialogDescription>
              Modify the message content before approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={10}
                className="font-sans text-sm"
                data-testid="edit-message-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateContent} data-testid="save-message-btn">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Single Message Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
        setScheduleDialogOpen(open);
        if (!open) setSelectedMessage(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Schedule Message
            </DialogTitle>
            <DialogDescription>
              Set when this message should be automatically sent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedMessage && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium">To: {getContactName(selectedMessage.contact_id)}</p>
                <p className="text-xs text-muted-foreground">{selectedMessage.channel}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm({...scheduleForm, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="schedule-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})}
                  data-testid="schedule-time"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The message will be sent automatically at the scheduled time via {selectedMessage?.channel}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleMessage} data-testid="confirm-schedule-btn">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Schedule Dialog */}
      <Dialog open={bulkScheduleDialogOpen} onOpenChange={setBulkScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Schedule {selectedMessages.length} Messages
            </DialogTitle>
            <DialogDescription>
              Messages will be scheduled with random gaps to avoid platform bans
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm">
                <strong>{selectedMessages.length}</strong> messages will be scheduled starting from the time below.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ⏱️ Random 30-60 minute gaps will be added automatically between each message to avoid bans.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm({...scheduleForm, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="bulk-schedule-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})}
                  data-testid="bulk-schedule-time"
                />
              </div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Estimated completion:</strong> {scheduleForm.date && scheduleForm.time ? 
                  new Date(
                    new Date(`${scheduleForm.date}T${scheduleForm.time}`).getTime() + 
                    (selectedMessages.length - 1) * 45 * 60000
                  ).toLocaleString() 
                  : "..."
                }
                <br/>
                <span className="text-muted-foreground/70">(Based on avg 45 min gap)</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkSchedule} data-testid="confirm-bulk-schedule-btn">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
