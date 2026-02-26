import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, Link2 } from "lucide-react";

interface ShareReportDialogProps {
  sessionId: string;
}

export function ShareReportDialog({ sessionId }: ShareReportDialogProps) {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      const { data, error } = await supabase
        .from("shared_reports" as any)
        .insert({
          session_id: sessionId,
          created_by: user.id,
        })
        .select("share_token")
        .single();

      if (error) throw error;
      return (data as any).share_token as string;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
      toast({ title: "Delningslänk skapad", description: "Kopiera länken för att dela rapporten." });
    },
    onError: (err: any) => {
      toast({ title: "Fel", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Kopierad!", description: "Länken har kopierats till urklipp." });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Dela
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dela rapport</DialogTitle>
          <DialogDescription>
            Skapa en delningslänk som andra kan använda för att läsa rapporten utan inloggning.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!shareUrl ? (
            <Button
              onClick={() => createShareMutation.mutate()}
              disabled={createShareMutation.isPending}
              className="w-full gap-2"
            >
              <Link2 className="h-4 w-4" />
              {createShareMutation.isPending ? "Skapar länk..." : "Skapa delningslänk"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
