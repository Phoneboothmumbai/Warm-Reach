import { useState, useEffect, useRef } from "react";
import { useAuth, API } from "@/App";
import {
  Users,
  Plus,
  Search,
  Filter,
  Upload,
  Download,
  MoreHorizontal,
  Mail,
  Phone,
  Building,
  MapPin,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  X,
  MessageSquare,
  Pause,
  Play,
  Calendar
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

const statusColors = {
  new: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  contacted: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  replied: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  interested: "bg-secondary/15 text-secondary border-secondary/20",
  not_interested: "bg-muted text-muted-foreground border-border",
  blacklisted: "bg-destructive/15 text-destructive border-destructive/20"
};

export const ContactsPage = () => {
  const { authFetch } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [selectedContactMessages, setSelectedContactMessages] = useState({ contact: null, messages: [], outreach_paused: false });
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    job_title: "",
    city: "",
    country: "",
    notes: ""
  });

  useEffect(() => {
    fetchContacts();
  }, [statusFilter, searchQuery]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      let url = `${API}/contacts?limit=100`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleViewMessages = async (contact) => {
    try {
      const response = await authFetch(`${API}/contacts/${contact.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        setSelectedContactMessages({
          contact: data.contact,
          messages: data.messages,
          outreach_paused: data.outreach_paused
        });
        setMessagesDialogOpen(true);
      } else {
        toast.error("Failed to load messages");
      }
    } catch (error) {
      toast.error("Failed to load messages");
    }
  };

  const handlePauseOutreach = async (contactId) => {
    try {
      const response = await authFetch(`${API}/contacts/${contactId}/pause`, {
        method: "POST"
      });
      if (response.ok) {
        toast.success("Outreach paused for this contact");
        fetchContacts();
        // Refresh messages dialog if open
        if (messagesDialogOpen && selectedContactMessages.contact?.id === contactId) {
          handleViewMessages(selectedContactMessages.contact);
        }
      } else {
        toast.error("Failed to pause outreach");
      }
    } catch (error) {
      toast.error("Failed to pause outreach");
    }
  };

  const handleResumeOutreach = async (contactId) => {
    try {
      const response = await authFetch(`${API}/contacts/${contactId}/resume`, {
        method: "POST"
      });
      if (response.ok) {
        toast.success("Outreach resumed - scheduled dates shifted forward");
        fetchContacts();
        // Refresh messages dialog if open
        if (messagesDialogOpen && selectedContactMessages.contact?.id === contactId) {
          handleViewMessages(selectedContactMessages.contact);
        }
      } else {
        toast.error("Failed to resume outreach");
      }
    } catch (error) {
      toast.error("Failed to resume outreach");
    }
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch(`${API}/contacts`, {
        method: "POST",
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        toast.success("Contact created successfully");
        setCreateDialogOpen(false);
        resetForm();
        fetchContacts();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create contact");
      }
    } catch (error) {
      toast.error("Failed to create contact");
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    try {
      const response = await authFetch(`${API}/contacts/${editContact.id}`, {
        method: "PUT",
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        toast.success("Contact updated successfully");
        setEditContact(null);
        resetForm();
        fetchContacts();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update contact");
      }
    } catch (error) {
      toast.error("Failed to update contact");
    }
  };

  const handleDeleteContact = async (id) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const response = await authFetch(`${API}/contacts/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        toast.success("Contact deleted");
        fetchContacts();
      }
    } catch (error) {
      toast.error("Failed to delete contact");
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedContacts.length === 0) return;
    try {
      const response = await authFetch(`${API}/contacts/bulk-status`, {
        method: "POST",
        body: JSON.stringify({
          contact_ids: selectedContacts,
          status: status
        })
      });
      if (response.ok) {
        toast.success(`${selectedContacts.length} contacts updated`);
        setSelectedContacts([]);
        fetchContacts();
      }
    } catch (error) {
      toast.error("Failed to update contacts");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await authFetch(`${API}/contacts/import`, {
        method: "POST",
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Imported ${result.imported} contacts. ${result.duplicates} duplicates skipped.`);
        setImportDialogOpen(false);
        fetchContacts();
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

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      company_name: "",
      job_title: "",
      city: "",
      country: "",
      notes: ""
    });
  };

  const openEditDialog = (contact) => {
    setFormData({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      company_name: contact.company_name || "",
      job_title: contact.job_title || "",
      city: contact.city || "",
      country: contact.country || "",
      notes: contact.notes || ""
    });
    setEditContact(contact);
  };

  const toggleContactSelection = (id) => {
    setSelectedContacts(prev =>
      prev.includes(id)
        ? prev.filter(cid => cid !== id)
        : [...prev, id]
    );
  };

  const toggleAllContacts = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const getContextWarnings = (contact) => {
    const flags = contact.context_flags || {};
    const warnings = [];
    if (flags.has_open_support_ticket) warnings.push("Open support ticket");
    if (flags.recent_inbound_email) warnings.push("Recent inbound email");
    if (flags.deal_stage_not_cold) warnings.push("Not cold stage");
    if (flags.do_not_contact) warnings.push("Do not contact");
    if (flags.negative_sentiment_detected) warnings.push("Negative sentiment");
    return warnings;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-2" data-testid="contacts-heading">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your outreach contacts and their context
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            data-testid="import-contacts-btn"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
            data-testid="create-contact-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-surface">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="contact-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="status-filter-select">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contacts</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <Card className="card-surface border-primary/30 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedContacts.length} contact(s) selected
              </span>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="bulk-status-dropdown">
                      Change Status
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("new")}>
                      Mark as New
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("contacted")}>
                      Mark as Contacted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate("interested")}>
                      Mark as Interested
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleBulkStatusUpdate("blacklisted")}
                      className="text-destructive"
                    >
                      Blacklist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContacts([])}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts Table */}
      <Card className="card-surface">
        <ScrollArea className="h-[600px]">
          <div className="min-w-[800px]">
            {/* Table Header */}
            <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/30 sticky top-0 z-10">
              <Checkbox
                checked={contacts.length > 0 && selectedContacts.length === contacts.length}
                onCheckedChange={toggleAllContacts}
                data-testid="select-all-checkbox"
              />
              <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-medium text-muted-foreground">
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Context</div>
              </div>
              <div className="w-10" />
            </div>

            {/* Table Body */}
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading contacts...
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No contacts found</p>
                <Button 
                  variant="link" 
                  onClick={() => {
                    resetForm();
                    setCreateDialogOpen(true);
                  }}
                  className="mt-2"
                >
                  Add your first contact
                </Button>
              </div>
            ) : (
              contacts.map((contact) => {
                const warnings = getContextWarnings(contact);
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "flex items-center gap-4 p-4 border-b border-border hover:bg-muted/30 transition-colors",
                      selectedContacts.includes(contact.id) && "bg-primary/5"
                    )}
                    data-testid={`contact-row-${contact.id}`}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContactSelection(contact.id)}
                    />
                    <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </p>
                          {contact.outreach_paused && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs px-1.5 py-0">
                              <Pause className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                        {contact.job_title && (
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.job_title}
                          </p>
                        )}
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        {contact.company_name && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="truncate">{contact.company_name}</span>
                          </div>
                        )}
                        {contact.city && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{contact.city}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Badge className={cn("text-xs border", statusColors[contact.status])}>
                          {contact.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        {warnings.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-destructive">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-medium">{warnings.length} flag(s)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-secondary">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">Clear</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`contact-menu-${contact.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleViewMessages(contact)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          View Messages
                        </DropdownMenuItem>
                        {contact.outreach_paused ? (
                          <DropdownMenuItem onClick={() => handleResumeOutreach(contact.id)}>
                            <Play className="w-4 h-4 mr-2" />
                            Resume Outreach
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handlePauseOutreach(contact.id)}>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause Outreach
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || !!editContact} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditContact(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
            <DialogDescription>
              {editContact ? "Update contact information" : "Add a new contact to your database"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editContact ? handleUpdateContact : handleCreateContact}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    data-testid="contact-firstname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    data-testid="contact-lastname-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="contact-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="contact-phone-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    data-testid="contact-company-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job_title">Job Title</Label>
                  <Input
                    id="job_title"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    data-testid="contact-jobtitle-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    data-testid="contact-city-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    data-testid="contact-country-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  data-testid="contact-notes-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" data-testid="contact-submit-btn">
                {editContact ? "Update Contact" : "Create Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple contacts at once
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
              <p className="text-xs text-muted-foreground mt-4">
                Required columns: first_name, last_name, email<br />
                Optional: phone, company_name, job_title, city, country
              </p>
              <Button 
                variant="link" 
                className="mt-2 text-primary"
                onClick={() => {
                  const csvContent = `first_name,last_name,email,phone,company_name,job_title,city,country
John,Doe,john.doe@example.com,+919876543210,Acme Corp,IT Manager,Mumbai,India
Jane,Smith,jane.smith@company.com,+919876543211,Tech Solutions,CTO,Delhi,India
Rahul,Kumar,rahul.kumar@startup.in,+919876543212,StartUp Inc,Founder,Bangalore,India`;
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'contacts_sample.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
                data-testid="download-sample-csv-btn"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Sample CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Messages Dialog */}
      <Dialog open={messagesDialogOpen} onOpenChange={setMessagesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Messages for {selectedContactMessages.contact?.first_name} {selectedContactMessages.contact?.last_name}
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>{selectedContactMessages.contact?.email}</span>
              {selectedContactMessages.outreach_paused ? (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <Pause className="w-3 h-3 mr-1" />
                  Outreach Paused
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <Play className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-0 -mx-6 px-6">
            {selectedContactMessages.messages.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No messages scheduled for this contact</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {selectedContactMessages.messages.map((message) => (
                  <div 
                    key={message.id} 
                    className="p-4 rounded-lg border border-border bg-muted/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {message.channel}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={
                            message.status === "sent" ? "bg-green-500/10 text-green-600" :
                            message.status === "scheduled" ? "bg-blue-500/10 text-blue-600" :
                            message.status === "pending_approval" ? "bg-yellow-500/10 text-yellow-600" :
                            "bg-muted"
                          }
                        >
                          {message.status?.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {message.blueprint_name}
                        </span>
                      </div>
                      {message.scheduled_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(message.scheduled_at).toLocaleDateString()} {new Date(message.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-shrink-0 gap-2">
            {selectedContactMessages.outreach_paused ? (
              <Button 
                variant="outline" 
                onClick={() => handleResumeOutreach(selectedContactMessages.contact?.id)}
                className="text-green-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Outreach
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => handlePauseOutreach(selectedContactMessages.contact?.id)}
                className="text-yellow-600"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause Outreach
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMessagesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
