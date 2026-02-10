import { useState, useEffect } from "react";
import { useAuth } from "@/App";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Globe, Target, Users, Package, Sparkles, Plus, X, Save, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BusinessProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    company_name: "",
    industry: "",
    website: "",
    tagline: "",
    about: "",
    products_services: [],
    key_clients: [],
    value_proposition: "",
    target_audience: "",
    tone_style: "professional"
  });
  
  const [newProduct, setNewProduct] = useState({ name: "", description: "" });
  const [newClient, setNewClient] = useState("");

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem("token");
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authFetch(`${API}/api/business-profile`);
      if (res.ok) {
        const data = await res.json();
        setProfile({
          company_name: data.company_name || "",
          industry: data.industry || "",
          website: data.website || "",
          tagline: data.tagline || "",
          about: data.about || "",
          products_services: data.products_services || [],
          key_clients: data.key_clients || [],
          value_proposition: data.value_proposition || "",
          target_audience: data.target_audience || "",
          tone_style: data.tone_style || "professional"
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    
    setSaving(true);
    try {
      const res = await authFetch(`${API}/api/business-profile`, {
        method: "POST",
        body: JSON.stringify(profile),
      });
      
      if (res.ok) {
        toast.success("Business profile saved successfully!");
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to save profile");
      }
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    if (newProduct.name.trim()) {
      setProfile(prev => ({
        ...prev,
        products_services: [...prev.products_services, { ...newProduct }]
      }));
      setNewProduct({ name: "", description: "" });
    }
  };

  const removeProduct = (index) => {
    setProfile(prev => ({
      ...prev,
      products_services: prev.products_services.filter((_, i) => i !== index)
    }));
  };

  const addClient = () => {
    if (newClient.trim() && !profile.key_clients.includes(newClient.trim())) {
      setProfile(prev => ({
        ...prev,
        key_clients: [...prev.key_clients, newClient.trim()]
      }));
      setNewClient("");
    }
  };

  const removeClient = (client) => {
    setProfile(prev => ({
      ...prev,
      key_clients: prev.key_clients.filter(c => c !== client)
    }));
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="business-profile-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Business Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your company details for AI-powered message generation
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={handleSave} disabled={saving} data-testid="save-profile-btn">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Profile
          </Button>
        )}
      </div>

      {!isOwnerOrAdmin && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-600 dark:text-yellow-400">
          <p className="text-sm">Only owners and admins can edit the business profile.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5" />
              Company Information
            </CardTitle>
            <CardDescription>Basic details about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={profile.company_name}
                onChange={(e) => setProfile(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Acme Corporation"
                disabled={!isOwnerOrAdmin}
                data-testid="company-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={profile.industry}
                onChange={(e) => setProfile(prev => ({ ...prev, industry: e.target.value }))}
                placeholder="IT Solutions, Healthcare, Finance..."
                disabled={!isOwnerOrAdmin}
                data-testid="industry-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                  className="pl-10"
                  disabled={!isOwnerOrAdmin}
                  data-testid="website-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={profile.tagline}
                onChange={(e) => setProfile(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="Your company's one-liner"
                disabled={!isOwnerOrAdmin}
                data-testid="tagline-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* About & Value Proposition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5" />
              About & Value Proposition
            </CardTitle>
            <CardDescription>What makes your company unique</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="about">About Your Business</Label>
              <Textarea
                id="about"
                value={profile.about}
                onChange={(e) => setProfile(prev => ({ ...prev, about: e.target.value }))}
                placeholder="Describe what your company does, your services, and expertise..."
                rows={4}
                disabled={!isOwnerOrAdmin}
                data-testid="about-textarea"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value_proposition">Unique Value Proposition</Label>
              <Textarea
                id="value_proposition"
                value={profile.value_proposition}
                onChange={(e) => setProfile(prev => ({ ...prev, value_proposition: e.target.value }))}
                placeholder="What differentiates you from competitors? Why should customers choose you?"
                rows={3}
                disabled={!isOwnerOrAdmin}
                data-testid="value-prop-textarea"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products & Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              Products & Services
            </CardTitle>
            <CardDescription>What you offer to your customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOwnerOrAdmin && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Product/Service name"
                    onKeyPress={(e) => handleKeyPress(e, addProduct)}
                    data-testid="new-product-name-input"
                  />
                  <Input
                    value={newProduct.description}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description (optional)"
                    onKeyPress={(e) => handleKeyPress(e, addProduct)}
                    data-testid="new-product-desc-input"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={addProduct} className="h-auto" data-testid="add-product-btn">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.products_services.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No products or services added yet</p>
              ) : (
                profile.products_services.map((product, index) => (
                  <div key={index} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg" data-testid={`product-item-${index}`}>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
                      )}
                    </div>
                    {isOwnerOrAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeProduct(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Key Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              Key Clients & Brands
            </CardTitle>
            <CardDescription>Notable clients you work with (AI will reference these)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOwnerOrAdmin && (
              <div className="flex gap-2">
                <Input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Add a client or brand name"
                  onKeyPress={(e) => handleKeyPress(e, addClient)}
                  data-testid="new-client-input"
                />
                <Button variant="outline" size="icon" onClick={addClient} data-testid="add-client-btn">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {profile.key_clients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 w-full text-center">No key clients added yet</p>
              ) : (
                profile.key_clients.map((client, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1.5 text-sm" data-testid={`client-badge-${index}`}>
                    {client}
                    {isOwnerOrAdmin && (
                      <button onClick={() => removeClient(client)} className="ml-2 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Audience & Communication Style */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5" />
              Target Audience & Communication
            </CardTitle>
            <CardDescription>Define who you're reaching out to and how</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Textarea
                id="target_audience"
                value={profile.target_audience}
                onChange={(e) => setProfile(prev => ({ ...prev, target_audience: e.target.value }))}
                placeholder="IT Directors, CTOs, Small Business Owners, Marketing Managers..."
                rows={3}
                disabled={!isOwnerOrAdmin}
                data-testid="target-audience-textarea"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone_style">Communication Style</Label>
              <Select
                value={profile.tone_style}
                onValueChange={(value) => setProfile(prev => ({ ...prev, tone_style: value }))}
                disabled={!isOwnerOrAdmin}
              >
                <SelectTrigger id="tone_style" data-testid="tone-style-select">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                This affects how AI generates messages and blueprints
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">How This Works</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The information you provide here will be used by our AI to generate personalized, contextually relevant messages and blueprints. 
                The more detailed and accurate your business profile, the better the AI can tailor outreach messages to your target audience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
