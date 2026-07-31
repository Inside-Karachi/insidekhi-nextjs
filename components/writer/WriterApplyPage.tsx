"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PenSquare, Clock, XCircle } from "lucide-react";

interface Application {
  id: number;
  message: string;
  portfolio_url: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
}

export function WriterApplyPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [application, setApplication] = React.useState<Application | null>(null);
  const [message, setMessage] = React.useState("");
  const [portfolioUrl, setPortfolioUrl] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/writer-applications")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setApplication(result.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!message || message.length < 20) {
      newErrors.message = "Tell us a bit more (at least 20 characters)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/writer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          portfolio_url: portfolioUrl || null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to submit application",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Application submitted", description: result.message });
      setApplication({
        id: result.data.id,
        message,
        portfolio_url: portfolioUrl || null,
        status: "pending",
        review_notes: null,
        created_at: new Date().toISOString(),
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to submit application",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (application && application.status === "pending") {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Application Under Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Thanks for applying! An admin will review your application soon.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">{application.message}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full border border-primary/20 mb-4">
          <PenSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            Become a Writer
          </span>
        </div>
        <h1 className="text-3xl font-bold">Write guides for Inside Karachi</h1>
        <p className="text-muted-foreground mt-2">
          Tell us why you&apos;d like to write for us, and an admin will review
          your application.
        </p>
      </div>

      {application?.status === "rejected" && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium">
                Your previous application wasn&apos;t approved
              </p>
              {application.review_notes && (
                <p className="text-sm text-muted-foreground mt-1">
                  {application.review_notes}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;re welcome to apply again below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">
                Why do you want to write for us? <Badge variant="outline">Required</Badge>
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your interests, writing experience, or ideas for guides..."
                rows={5}
                maxLength={2000}
              />
              {errors.message && (
                <p className="text-sm text-destructive">{errors.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio_url">Portfolio / writing sample (optional)</Label>
              <Input
                id="portfolio_url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
