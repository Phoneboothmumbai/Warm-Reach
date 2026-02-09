import { useState, useEffect } from "react";
import { useNavigate, NavLink, Routes, Route } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
  Package,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Edit,
  Trash2,
  Key,
  Shield,
  TrendingUp,
  MessageSquare,
  Mail,
  RefreshCw,
  UserCheck,
  UserX,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

const adminNavigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Plans", href: "/admin/plans", icon: Package },
  { name: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
];

// Admin Layout
const AdminLayout = ({ children }) => {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">Super Admin</span>
        </div>
        <nav className="p-4 space-y-1">
          {adminNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/admin"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <Button variant="outline" className="w-full" onClick={() => navigate("/app/dashboard")}>
            Back to App
          </Button>
          <Button variant="ghost" className="w-full mt-2 text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

// Dashboard Page
const AdminDashboard = () => {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API}/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: "Total Tenants", value: stats?.total_tenants || 0, icon: Building2, color: "text-blue-500" },
    { title: "Active Tenants", value: stats?.active_tenants || 0, icon: UserCheck, color: "text-green-500" },
    { title: "Total Users", value: stats?.total_users || 0, icon: Users, color: "text-purple-500" },
    { title: "Messages Sent", value: stats?.total_messages_sent || 0, icon: MessageSquare, color: "text-orange-500" },
    { title: "New This Week", value: stats?.new_this_week || 0, icon: TrendingUp, color: "text-cyan-500" },
    { title: "Total Contacts", value: stats?.total_contacts || 0, icon: Users, color: "text-pink-500" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your SaaS platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={cn("w-10 h-10", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Tenants Page
const AdminTenants = () => {
  const { authFetch } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchTenants();
  }, [search]);

  const fetchTenants = async () => {
    try {
      const res = await authFetch(`${API}/admin/tenants?search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants);
        setTotal(data.total);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">{total} total tenants</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Messages Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{tenant.name || tenant.company_name || "N/A"}</p>
                    <p className="text-sm text-muted-foreground">{tenant.id.slice(0, 8)}...</p>
                  </div>
                </TableCell>
                <TableCell>{tenant.users_count || 0}</TableCell>
                <TableCell>{tenant.contacts_count || 0}</TableCell>
                <TableCell>{tenant.messages_sent || 0}</TableCell>
                <TableCell>
                  <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                    {tenant.status || "active"}
                  </Badge>
                </TableCell>
                <TableCell>{tenant.subscription?.plan?.name || "Free"}</TableCell>
                <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

// Users Page
const AdminUsers = () => {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [resetDialog, setResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${API}/admin/users?search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    try {
      const res = await authFetch(`${API}/admin/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword })
      });
      if (res.ok) {
        toast.success("Password reset successfully");
        setResetDialog(false);
        setNewPassword("");
        setSelectedUser(null);
      } else {
        toast.error("Failed to reset password");
      }
    } catch (error) {
      toast.error("Failed to reset password");
    }
  };

  const toggleSuperAdmin = async (user) => {
    try {
      const res = await authFetch(`${API}/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_super_admin: !user.is_super_admin })
      });
      if (res.ok) {
        toast.success(`Super admin ${user.is_super_admin ? "removed" : "granted"}`);
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const toggleActive = async (user) => {
    try {
      const res = await authFetch(`${API}/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (res.ok) {
        toast.success(`User ${user.is_active ? "deactivated" : "activated"}`);
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">{total} total users</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell>{user.tenant?.name || user.tenant?.company_name || "N/A"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="outline">{user.role}</Badge>
                    {user.is_super_admin && <Badge className="bg-yellow-500">Super Admin</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active !== false ? "default" : "destructive"}>
                    {user.is_active !== false ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => { setSelectedUser(user); setResetDialog(true); }}>
                        <Key className="w-4 h-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleSuperAdmin(user)}>
                        <Crown className="w-4 h-4 mr-2" />
                        {user.is_super_admin ? "Remove Super Admin" : "Make Super Admin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(user)}>
                        {user.is_active !== false ? (
                          <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                        ) : (
                          <><UserCheck className="w-4 h-4 mr-2" /> Activate</>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>Cancel</Button>
            <Button onClick={handleResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Plans Page
const AdminPlans = () => {
  const { authFetch } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    currency: "INR",
    billing_cycle: "monthly",
    messages_per_day: 10,
    contacts_limit: 50,
    channels: ["whatsapp"],
    features: [],
    is_popular: false,
    is_active: true,
    sort_order: 0
  });
  const [featuresText, setFeaturesText] = useState("");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await authFetch(`${API}/admin/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (plan = null) => {
    if (plan) {
      setSelectedPlan(plan);
      setFormData(plan);
      setFeaturesText(plan.features?.join("\n") || "");
    } else {
      setSelectedPlan(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        currency: "INR",
        billing_cycle: "monthly",
        messages_per_day: 10,
        contacts_limit: 50,
        channels: ["whatsapp"],
        features: [],
        is_popular: false,
        is_active: true,
        sort_order: plans.length + 1
      });
      setFeaturesText("");
    }
    setEditDialog(true);
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      features: featuresText.split("\n").filter(f => f.trim())
    };

    try {
      const url = selectedPlan ? `${API}/admin/plans/${selectedPlan.id}` : `${API}/admin/plans`;
      const method = selectedPlan ? "PUT" : "POST";
      
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(selectedPlan ? "Plan updated" : "Plan created");
        setEditDialog(false);
        fetchPlans();
      } else {
        toast.error("Failed to save plan");
      }
    } catch (error) {
      toast.error("Failed to save plan");
    }
  };

  const handleDelete = async (planId) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      const res = await authFetch(`${API}/admin/plans/${planId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Plan deleted");
        fetchPlans();
      } else {
        toast.error("Failed to delete plan");
      }
    } catch (error) {
      toast.error("Failed to delete plan");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Pricing Plans</h1>
          <p className="text-muted-foreground">Manage your subscription plans</p>
        </div>
        <Button onClick={() => openEditDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Plan
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={cn(plan.is_popular && "border-primary")}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    {plan.is_popular && <Badge>Popular</Badge>}
                    {!plan.is_active && <Badge variant="destructive">Inactive</Badge>}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">
                {plan.price === 0 ? "Free" : `₹${plan.price}`}
                {plan.price > 0 && <span className="text-sm font-normal">/{plan.billing_cycle}</span>}
              </div>
              <div className="space-y-2 text-sm">
                <p>📨 {plan.messages_per_day} messages/day</p>
                <p>👥 {plan.contacts_limit} contacts</p>
                <p>📱 {plan.channels?.join(", ")}</p>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Features:</p>
                <ul className="text-sm space-y-1">
                  {plan.features?.map((f, i) => (
                    <li key={i} className="text-muted-foreground">• {f}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Messages/Day</Label>
                <Input
                  type="number"
                  value={formData.messages_per_day}
                  onChange={(e) => setFormData({ ...formData, messages_per_day: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contacts Limit</Label>
                <Input
                  type="number"
                  value={formData.contacts_limit}
                  onChange={(e) => setFormData({ ...formData, contacts_limit: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features (one per line)</Label>
              <Textarea
                rows={5}
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                placeholder="10 messages/day&#10;50 contacts&#10;WhatsApp only"
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_popular}
                  onCheckedChange={(c) => setFormData({ ...formData, is_popular: c })}
                />
                <Label>Mark as Popular</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(c) => setFormData({ ...formData, is_active: c })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Subscriptions Page
const AdminSubscriptions = () => {
  const { authFetch } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await authFetch(`${API}/admin/subscriptions`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions);
        setTotal(data.total);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    active: "bg-green-500",
    trial: "bg-blue-500",
    cancelled: "bg-red-500",
    expired: "bg-gray-500"
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">{total} total subscriptions</p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell>{sub.tenant?.name || sub.tenant?.company_name || "N/A"}</TableCell>
                <TableCell>{sub.plan?.name || "N/A"}</TableCell>
                <TableCell>
                  <Badge className={statusColors[sub.status]}>{sub.status}</Badge>
                </TableCell>
                <TableCell>{new Date(sub.started_at).toLocaleDateString()}</TableCell>
                <TableCell>{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

// Main Admin Component with Routes
const SuperAdminPage = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/tenants" element={<AdminTenants />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/plans" element={<AdminPlans />} />
        <Route path="/subscriptions" element={<AdminSubscriptions />} />
      </Routes>
    </AdminLayout>
  );
};

export default SuperAdminPage;
