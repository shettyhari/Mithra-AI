import { useState, useEffect } from "react";
import { useGetUserSettings, useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User, Palette, BrainCircuit, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetUserSettings();
  const updateSettings = useUpdateUserSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    theme: 'dark',
    accentColor: '#A855F7',
    animationsEnabled: true,
    notificationsEnabled: true,
    customInstructions: ''
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        theme: settings.theme || 'dark',
        accentColor: settings.accentColor || '#A855F7',
        animationsEnabled: settings.animationsEnabled ?? true,
        notificationsEnabled: settings.notificationsEnabled ?? true,
        customInstructions: settings.customInstructions || ''
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Settings saved", description: "Your preferences have been updated." });
        queryClient.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 max-w-3xl mx-auto overflow-y-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your personal Mithra experience.</p>
        </div>
        <Button onClick={handleSave} disabled={updateSettings.isPending} variant="premium" className="gap-2">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>

      <Card className="glass-card border-white/10 bg-background/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Palette className="w-5 h-5 text-purple-400" /> Appearance
          </CardTitle>
          <CardDescription>Customize how Mithra looks and feels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-white">Theme Preference</Label>
            <Select value={formData.theme} onValueChange={v => setFormData({...formData, theme: v})}>
              <SelectTrigger className="bg-white/5 border-white/10 w-full sm:w-64">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 border-white/10">
                <SelectItem value="dark">Dark Mode (Default)</SelectItem>
                <SelectItem value="light">Light Mode</SelectItem>
                <SelectItem value="system">System Default</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">Cinematic Animations</Label>
              <p className="text-xs text-muted-foreground">Enable high-quality background and transition effects.</p>
            </div>
            <Switch 
              checked={formData.animationsEnabled} 
              onCheckedChange={v => setFormData({...formData, animationsEnabled: v})}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-white/10 bg-background/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <BrainCircuit className="w-5 h-5 text-cyan-400" /> AI Directives
          </CardTitle>
          <CardDescription>Tell Mithra how to respond to you personally.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Custom Instructions</Label>
            <textarea 
              className="w-full h-32 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder="E.g., I'm a software engineer, give technical answers. Keep responses concise. Never use emojis."
              value={formData.customInstructions}
              onChange={e => setFormData({...formData, customInstructions: e.target.value})}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-white/10 bg-background/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Bell className="w-5 h-5 text-yellow-400" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">System Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive alerts for tasks and shared files.</p>
            </div>
            <Switch 
              checked={formData.notificationsEnabled} 
              onCheckedChange={v => setFormData({...formData, notificationsEnabled: v})}
              className="data-[state=checked]:bg-purple-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}